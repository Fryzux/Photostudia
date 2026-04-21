from rest_framework import serializers

class AIPredictRequestSerializer(serializers.Serializer):
    date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d'])


class AIForecastRequestSerializer(serializers.Serializer):
    hall_id = serializers.IntegerField(required=False, min_value=1)
    date_from = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d'])
    date_to = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d'])

    def validate(self, attrs):
        date_from = attrs['date_from']
        date_to = attrs['date_to']

        if date_to < date_from:
            raise serializers.ValidationError({'date_to': 'date_to must be later than or equal to date_from.'})

        period_days = (date_to - date_from).days + 1
        if period_days > 31:
            raise serializers.ValidationError({'date_to': 'Forecast period is limited to 31 days.'})

        return attrs
