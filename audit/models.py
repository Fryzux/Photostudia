from django.db import models
from django.conf import settings

class ActionLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        user_display = self.user.username if self.user else "Anonymous"
        return f"{self.timestamp} - {user_display}: {self.action}"
