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
    def create_booking(user, hall, start_time, end_time, promo_code=None):
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
        total_amount = hall.price_per_hour * duration_hours
        
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
    def process_payment(order, amount, method):
        """
        Processes payment for an order.
        """
        if order.status != 'PENDING':
            raise ValidationError("Order is not pending.")
        
        if Decimal(amount) < order.total_amount:
            raise ValidationError("Insufficient payment amount.")
            
        payment = Payment.objects.create(
            order=order,
            amount=amount,
            method=method,
            is_successful=True,
            transaction_id=f"tx_{order.id}_{uuid.uuid4().hex[:8]}"
        )
        
        order.status = 'COMPLETED'
        order.save()
        
        return payment
