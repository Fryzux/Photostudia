from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # AbstractUser provides username, password, email, first_name, last_name, is_active, is_staff, is_superuser
    # and handles hashing automatically.
    phone = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.username

class ClientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    discount_level = models.IntegerField(default=0)
    preferences = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Profile of {self.user.username}"
