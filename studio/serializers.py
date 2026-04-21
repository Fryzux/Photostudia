from rest_framework import serializers
from .models import Hall, HallImage, Booking, Order, Payment
from decimal import Decimal


class HallImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True)

    class Meta:
        model = HallImage
        fields = ['id', 'image', 'created_at']


class HallSerializer(serializers.ModelSerializer):
    images = HallImageSerializer(source='gallery_images', many=True, read_only=True)

    class Meta:
        model = Hall
        fields = ['id', 'name', 'description', 'is_active', 'capacity', 'price_per_hour', 'image', 'images']

class BookingSerializer(serializers.ModelSerializer):
    # For writing
    hall_id = serializers.PrimaryKeyRelatedField(queryset=Hall.objects.all(), source='hall', write_only=True)
    extra_services_total = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
        write_only=True,
        default=0,
    )
    
    # For reading
    hall = HallSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'hall', 'hall_id', 'start_time', 'end_time', 'extra_services_total']
        read_only_fields = ['id', 'user']

class OrderSerializer(serializers.ModelSerializer):
    booking = BookingSerializer(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    promo_code = serializers.CharField(source='applied_promo.code', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id',
            'booking',
            'user_id',
            'username',
            'user_email',
            'total_amount',
            'discount_amount',
            'final_amount',
            'promo_code',
            'status',
            'created_at',
        ]
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
    promo_code = serializers.CharField(required=False, allow_blank=True, max_length=32)

class PaymentSerializer(serializers.ModelSerializer):
    """Output serializer with full payment details."""
    order = OrderSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'order', 'amount', 'method', 'is_successful', 'transaction_id', 'created_at']
        read_only_fields = fields
