from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from .repositories import BookingRepository, OrderRepository, HallRepository
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
        if start_time >= end_time:
            raise ValidationError("End time must be after start time.")
        
        # Use Repository for overlap check
        overlapping = BookingRepository.get_overlapping_bookings(hall, start_time, end_time, lock=True)
        if overlapping.exists():
            raise BookingConflictError("This hall is already booked for the selected time slot.")
        
        # Use Repository for creation
        booking = BookingRepository.create(user=user, hall=hall, start_time=start_time, end_time=end_time)
        
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
        
        # Use Repository for Order creation
        order = OrderRepository.create(user=user, booking=booking, total_amount=total_amount, status='PENDING')
        
        # TRIGGER EMAIL HERE (Moved from View per PDF requirement #7)
        from .tasks import send_booking_confirmation_email
        send_booking_confirmation_email.delay(booking.id, user.email)
        
        return booking, order, applied_promo

    @staticmethod
    def create_recurring_bookings(user, hall, start_time, end_time, weeks=4):
        """
        Creates recurring bookings for the next X weeks.
        Each booking triggers an email via Service logic.
        """
        from datetime import timedelta
        created_bookings = []
        for i in range(weeks):
            current_start = start_time + timedelta(weeks=i)
            current_end = end_time + timedelta(weeks=i)
            try:
                booking, order, _ = BookingService.create_booking(user, hall, current_start, current_end)
                created_bookings.append(booking)
            except (BookingConflictError, ValidationError) as e:
                # Log error but continue with other weeks? Usually we'd stop or report.
                pass
        return created_bookings

class PaymentService:
    @staticmethod
    @transaction.atomic
    def process_payment(order, amount, method):
        if order.status != 'PENDING':
            raise ValidationError("Order is not pending.")
        
        if Decimal(amount) < order.total_amount:
            raise ValidationError("Insufficient payment amount.")
            
        # Используем Repository (Задание #10)
        payment = PaymentRepository.create(
            order=order,
            amount=amount,
            method=method,
            is_successful=True,
            transaction_id=f"tx_{order.id}_{uuid.uuid4().hex[:8]}"
        )
        
        # Обновляем статус заказа через Repository (Задание #10)
        OrderRepository.update_status(order, 'COMPLETED')
        
        return payment


class OrderService:
    @staticmethod
    def change_status(order, new_status):
        # Используем Repository (Задание #10)
        from .repositories import OrderRepository
        OrderRepository.update_status(order, new_status)
        
        # Если заказ отменяется, освобождаем слот (Задание #8)
        if new_status == 'CANCELLED' and getattr(order, 'booking', None):
            order.booking.delete()
            
        # Broadcast the new status to the WebSocket group
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'order_{order.id}',
            {
                'type': 'order_status_update',
                'order_id': order.id,
                'status': new_status
            }
        )
        return order
