from rest_framework import serializers
from datetime import datetime

class AIPredictRequestSerializer(serializers.Serializer):
    date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d'])
