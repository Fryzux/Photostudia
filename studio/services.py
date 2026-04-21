from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from .repositories import BookingRepository
from .models import Booking, Order, Payment
from decimal import Decimal
import uuid

class BookingService:
    @staticmethod
    @transaction.atomic
    def create_booking(user, hall, start_time, end_time, extra_services_total=Decimal('0')):
        """
        Creates a booking with overlap validation and generates an order within a transaction.
        """
        if start_time >= end_time:
            raise ValidationError("End time must be after start time.")
        
        # Check overlaps
        overlapping = BookingRepository.get_overlapping_bookings(hall, start_time, end_time)
        # We can lock rows or depend on isolation level, but simple select inside atomic is standard.
        # For stricter consistency, select_for_update() could be used on the hall row or a specific constraint could be added.
        if overlapping.exists():
            raise ValidationError("This hall is already booked for the selected time slot.")
        
        # Create Booking
        booking = Booking.objects.create(
            user=user,
            hall=hall,
            start_time=start_time,
            end_time=end_time
        )
        
        extra_services_total = Decimal(str(extra_services_total or 0))
        if extra_services_total < 0:
            raise ValidationError("extra_services_total must be non-negative.")

        # Calculate amount (simple hours calculation)
        duration_hours = Decimal((end_time - start_time).total_seconds()) / Decimal(3600)
        total_amount = (hall.price_per_hour * duration_hours) + extra_services_total
        
        # Create pending Order
        order = Order.objects.create(
            user=user,
            booking=booking,
            total_amount=total_amount,
            status='PENDING'
        )
        
        return booking, order

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

        if applied_promo:
            applied_promo.usage_count = (applied_promo.usage_count or 0) + 1
            applied_promo.save(update_fields=['usage_count', 'updated_at'])
        
        return payment
