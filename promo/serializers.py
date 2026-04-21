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
            'promo_type',
            'value',
            'expiry',
            'usage_limit',
            'usage_count',
            'is_active',
            'valid_from',
            'valid_to',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'usage_count', 'created_at', 'updated_at']

    def validate_code(self, value):
        return value.strip().upper()

    def validate_discount_percent(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError('Discount must be between 1 and 100 percent.')
        return value

    def validate(self, attrs):
        valid_from = attrs.get('valid_from')
        valid_to = attrs.get('valid_to')
        expiry = attrs.get('expiry')
        promo_type = attrs.get('promo_type', getattr(self.instance, 'promo_type', 'PERCENT'))
        value = attrs.get('value', getattr(self.instance, 'value', None))

        if valid_from and valid_to and valid_to <= valid_from:
            raise serializers.ValidationError({'valid_to': 'valid_to must be later than valid_from.'})

        if promo_type == 'PERCENT' and value is not None:
            if value < 1 or value > 100:
                raise serializers.ValidationError({'value': 'For percent promos, value must be between 1 and 100.'})

        if expiry and valid_from and expiry <= valid_from:
            raise serializers.ValidationError({'expiry': 'expiry must be later than valid_from.'})

        return attrs

    def create(self, validated_data):
        if 'value' not in validated_data:
            validated_data['value'] = validated_data.get('discount_percent', 0)
        if 'expiry' not in validated_data:
            validated_data['expiry'] = validated_data.get('valid_to')
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'value' not in validated_data and 'discount_percent' in validated_data:
            validated_data['value'] = validated_data['discount_percent']
        if 'expiry' not in validated_data and 'valid_to' in validated_data:
            validated_data['expiry'] = validated_data['valid_to']
        return super().update(instance, validated_data)


class PromoValidationSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    order_id = serializers.IntegerField(min_value=1)

    def validate_code(self, value):
        return value.strip().upper()
