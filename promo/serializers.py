from rest_framework import serializers

from .models import PromoCode


class PromoCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromoCode
        fields = [
            'id',
            'code',
            'description',
            'discount_percent',
            'is_active',
            'valid_from',
            'valid_to',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_code(self, value):
        return value.strip().upper()

    def validate_discount_percent(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError('Discount must be between 1 and 100 percent.')
        return value

    def validate(self, attrs):
        valid_from = attrs.get('valid_from')
        valid_to = attrs.get('valid_to')

        if valid_from and valid_to and valid_to <= valid_from:
            raise serializers.ValidationError({'valid_to': 'valid_to must be later than valid_from.'})

        return attrs
