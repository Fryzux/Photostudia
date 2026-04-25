from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from .repositories import BookingRepository
from .models import Booking, Order, Payment
from decimal import Decimal
import uuid


class BookingConflictError(Exception):
    """Raised when a booking slot is already taken — maps to HTTP 409."""
    pass

class BookingService:
    @staticmethod
    @transaction.atomic
    def create_booking(user, hall, start_time, end_time, promo_code=None, extra_services_total=None):
        """
        Creates a booking with overlap validation and generates an order within a transaction.
        Optionally applies a promo code discount to the order total.
        """
        if start_time >= end_time:
            raise ValidationError("End time must be after start time.")

        # Check overlaps with SELECT FOR UPDATE to prevent race conditions
        overlapping = BookingRepository.get_overlapping_bookings(hall, start_time, end_time, lock=True)
        if overlapping.exists():
            raise BookingConflictError("This hall is already booked for the selected time slot.")

        # Create Booking
        booking = Booking.objects.create(
            user=user,
            hall=hall,
            start_time=start_time,
            end_time=end_time
        )

        # Calculate amount
        duration_hours = Decimal((end_time - start_time).total_seconds()) / Decimal(3600)
        services_cost = Decimal(str(extra_services_total)) if extra_services_total else Decimal('0')
        total_amount = (hall.price_per_hour * duration_hours) + services_cost
        
        # Apply promo code discount if provided
        applied_promo = None
        if promo_code:
            from django.utils import timezone
            from promo.models import PromoCode
            now = timezone.now()
            try:
                promo = PromoCode.objects.get(
                    code=promo_code,
                    hall=hall,
                    is_active=True,
                    valid_from__lte=now,
                    valid_to__gte=now,
                    hour_from__lte=start_time.hour,
                    hour_to__gt=start_time.hour,
                )
                discount = Decimal(promo.discount_percent) / Decimal(100)
                total_amount = total_amount * (Decimal(1) - discount)
                applied_promo = promo.code
            except PromoCode.DoesNotExist:
                raise ValidationError(f"Промокод '{promo_code}' недействителен или не подходит для этого слота.")
        
        # Create pending Order
        order = Order.objects.create(
            user=user,
            booking=booking,
            total_amount=total_amount,
            status='PENDING'
        )
        
        return booking, order, applied_promo

class PaymentService:
    @staticmethod
    @transaction.atomic
    def process_payment(order, amount, method, promo_code=None):
        """
        Processes payment for an order.
        """
        if order.status != 'PENDING':
            raise ValidationError("Order is not pending.")
        
        if Decimal(amount) < order.total_amount:
            raise ValidationError("Insufficient payment amount.")

        discount_amount = Decimal('0')
        final_amount = Decimal(order.total_amount)
        applied_promo = None

        if promo_code:
            from promo.models import PromoCode
            from promo.services import calculate_promo_for_amount, validate_promo

            normalized_code = str(promo_code).strip().upper()
            if not normalized_code:
                raise ValidationError("Promo code cannot be empty.")

            promo = PromoCode.objects.select_for_update().filter(code=normalized_code).first()
            if not promo:
                raise ValidationError("Promo code is invalid.")

            validate_promo(promo)
            discount_amount, final_amount = calculate_promo_for_amount(promo, order.total_amount)
            applied_promo = promo
            
        payment = Payment.objects.create(
            order=order,
            amount=final_amount,
            method=method,
            is_successful=True,
            transaction_id=f"tx_{order.id}_{uuid.uuid4().hex[:8]}"
        )
        
        order.status = 'COMPLETED'
        order.discount_amount = discount_amount
        order.final_amount = final_amount
        order.applied_promo = applied_promo
        order.save()

        return payment
