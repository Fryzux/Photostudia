from rest_framework import serializers
from .models import ActionLog


class ActionLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = ActionLog
        fields = ['id', 'username', 'action', 'details', 'timestamp']

    def get_username(self, obj):
        return obj.user.username if obj.user else 'Anonymous'
