from django.db.models import Q
from .models import Booking, Hall

class BookingRepository:
    @staticmethod
    def get_overlapping_bookings(hall, start_time, end_time, exclude_booking_id=None, lock=False):
        query = Q(hall=hall) & (
            Q(start_time__lt=end_time) & Q(end_time__gt=start_time)
        )
        queryset = Booking.objects.filter(query)
        if exclude_booking_id:
            queryset = queryset.exclude(id=exclude_booking_id)
        if lock:
            queryset = queryset.select_for_update()
        return queryset

    @staticmethod
    def get_user_bookings(user):
        return Booking.objects.filter(user=user).order_by('-start_time')

    @staticmethod
    def filter_by_date(date):
        return Booking.objects.filter(start_time__date=date)

    @staticmethod
    def create(user, hall, start_time, end_time):
        return Booking.objects.create(
            user=user, hall=hall, start_time=start_time, end_time=end_time
        )

class HallRepository:
    @staticmethod
    def get_all():
        return Hall.objects.all().order_by('name')

    @staticmethod
    def get_by_id(hall_id):
        return Hall.objects.filter(id=hall_id).first()

class OrderRepository:
    @staticmethod
    def create(user, booking, total_amount, status='PENDING'):
        from .models import Order
        return Order.objects.create(
            user=user, booking=booking, total_amount=total_amount, status=status
        )

    @staticmethod
    def get_by_id(order_id):
        from .models import Order
        return Order.objects.filter(id=order_id).first()

    @staticmethod
    def filter_by_user(user):
        from .models import Order
        return Order.objects.filter(user=user).order_by('-created_at')

    @staticmethod
    def update_status(order, status):
        order.status = status
        order.save(update_fields=['status'])
        return order


class PaymentRepository:
    @staticmethod
    def create(order, amount, method, is_successful=True, transaction_id=None):
        from .models import Payment
        return Payment.objects.create(
            order=order,
            amount=amount,
            method=method,
            is_successful=is_successful,
            transaction_id=transaction_id
        )
