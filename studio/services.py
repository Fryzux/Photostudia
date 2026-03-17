from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from .repositories import BookingRepository
from .models import Booking, Order, Payment
from decimal import Decimal
import uuid

class BookingService:
    @staticmethod
    @transaction.atomic
    def create_booking(user, hall, start_time, end_time):
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
        
        # Calculate amount (simple hours calculation)
        duration_hours = Decimal((end_time - start_time).total_seconds()) / Decimal(3600)
        total_amount = hall.price_per_hour * duration_hours
        
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
