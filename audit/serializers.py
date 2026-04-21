from rest_framework import serializers

from .models import ActionLog


class ActionLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = ActionLog
        fields = ['id', 'action', 'details', 'timestamp', 'user', 'username', 'user_email']
        read_only_fields = fields

    def get_username(self, obj):
        return obj.user.username if obj.user else 'Anonymous'

    def get_user_email(self, obj):
        return obj.user.email if obj.user else ''
