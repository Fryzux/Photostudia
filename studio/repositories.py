from django.db.models import Q
from .models import Booking, Hall

class BookingRepository:
    @staticmethod
    def get_overlapping_bookings(hall, start_time, end_time, exclude_booking_id=None):
        """
        Check if there are any bookings for the given hall that overlap with the requested time.
        """
        query = Q(hall=hall) & (
            Q(start_time__lt=end_time) & Q(end_time__gt=start_time)
        )
        queryset = Booking.objects.filter(query)
        
        if exclude_booking_id:
            queryset = queryset.exclude(id=exclude_booking_id)
            
        return queryset

    @staticmethod
    def get_user_bookings(user):
        return Booking.objects.filter(user=user).order_by('-start_time')

class HallRepository:
    @staticmethod
    def get_hall_by_id(hall_id):
        return Hall.objects.filter(id=hall_id).first()
