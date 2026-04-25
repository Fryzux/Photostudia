from rest_framework import serializers
from .models import ActionLog


class ActionLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = ActionLog
        fields = ['id', 'user', 'username', 'user_email', 'action', 'details', 'timestamp']

    def get_user(self, obj):
        return obj.user.id if obj.user else None

    def get_username(self, obj):
        return obj.user.username if obj.user else 'Anonymous'

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None
