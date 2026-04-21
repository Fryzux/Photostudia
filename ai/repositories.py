from studio.models import Booking

class AIRepository:
    @staticmethod
    def get_count_for_date(target_date):
        return Booking.objects.filter(start_time__date=target_date).count()
