from rest_framework import serializers
from .models import PromoCode


class PromoCodeSerializer(serializers.ModelSerializer):
    hall_name = serializers.CharField(source='hall.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = PromoCode
        fields = [
            'id', 'code', 'hall', 'hall_name',
            'discount_percent', 'valid_from', 'valid_to',
            'hour_from', 'hour_to', 'is_active',
            'created_by', 'created_by_username', 'created_at'
        ]
        read_only_fields = ['id', 'code', 'created_by', 'created_by_username', 'created_at']


class PromoCodeCreateSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=32, required=False, allow_blank=True)

    class Meta:
        model = PromoCode
        fields = ['code', 'hall', 'discount_percent', 'valid_from', 'valid_to', 'hour_from', 'hour_to']

    def validate_code(self, value):
        value = value.strip().upper()
        if value and PromoCode.objects.filter(code=value).exists():
            raise serializers.ValidationError('Промокод с таким кодом уже существует.')
        return value or None  # пустая строка → автогенерация


class PromoValidateSerializer(serializers.Serializer):
    code = serializers.CharField()
    order_id = serializers.IntegerField()
