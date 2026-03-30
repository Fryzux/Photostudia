from rest_framework import serializers
from .models import User, Hall, Booking, AuditLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff']

class HallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hall
        fields = '__all__'

class BookingSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)
    hall_detail = HallSerializer(source='hall', read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'user', 'user_detail', 'hall', 'hall_detail', 'start_time', 'end_time', 'status', 'created_at']

    def validate(self, data):
        """Проверка на пересечение бронирований."""
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        hall = data.get('hall')

        if start_time >= end_time:
            raise serializers.ValidationError("Время начала должно быть раньше времени окончания.")

        # Проверка на наложение (overlap)
        overlapping_bookings = Booking.objects.filter(
            hall=hall,
            start_time__lt=end_time,
            end_time__gt=start_time
        ).exclude(status='CANCELLED')

        if self.instance:
            overlapping_bookings = overlapping_bookings.exclude(pk=self.instance.pk)

        if overlapping_bookings.exists():
            raise serializers.ValidationError("Этот зал уже забронирован на выбранное время.")

        return data

class AuditLogSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
