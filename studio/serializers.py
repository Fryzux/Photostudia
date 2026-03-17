from rest_framework import serializers
from .models import Hall, Booking, Order, Payment

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
        read_only_fields = ['id', 'user', 'total_amount', 'created_at']

class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status']

class PaymentCreateSerializer(serializers.Serializer):
    """Input serializer for creating a payment."""
    order_id = serializers.PrimaryKeyRelatedField(
        queryset=Order.objects.all(),
        source='order',
        help_text="ID of the pending Order to pay for."
    )
    method = serializers.ChoiceField(
        choices=[('card', 'Card'), ('cash', 'Cash'), ('online', 'Online')],
        help_text="Payment method."
    )

class PaymentSerializer(serializers.ModelSerializer):
    """Output serializer with full payment details."""
    order = OrderSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'order', 'amount', 'method', 'is_successful', 'transaction_id', 'created_at']
        read_only_fields = fields
