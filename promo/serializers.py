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
    class Meta:
        model = PromoCode
        fields = ['hall', 'discount_percent', 'valid_from', 'valid_to', 'hour_from', 'hour_to']


class PromoValidateSerializer(serializers.Serializer):
    code = serializers.CharField()
    hall_id = serializers.IntegerField()
    start_time = serializers.DateTimeField()
