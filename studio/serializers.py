from rest_framework import serializers
from .models import Hall, Booking, Order

class HallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hall
        fields = '__all__'

class BookingSerializer(serializers.ModelSerializer):
    # For writing
    hall_id = serializers.PrimaryKeyRelatedField(queryset=Hall.objects.all(), source='hall', write_only=True)
    
    # For reading
    hall = HallSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'hall', 'hall_id', 'start_time', 'end_time']
        read_only_fields = ['id', 'user']

class OrderSerializer(serializers.ModelSerializer):
    booking = BookingSerializer(read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'booking', 'total_amount', 'status', 'created_at']
        read_only_fields = ['id', 'user', 'total_amount', 'status', 'created_at']
