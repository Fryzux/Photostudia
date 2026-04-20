from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import ActionLog
from studio.models import Booking

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    ActionLog.objects.create(user=user, action="User Logged In")

@receiver(post_save, sender=Booking)
def log_booking_created_or_updated(sender, instance, created, **kwargs):
    action = "Booking Created" if created else "Booking Updated"
    ActionLog.objects.create(user=instance.user, action=action, details=f"Booking id: {instance.id}")

@receiver(post_delete, sender=Booking)
def log_booking_deleted(sender, instance, **kwargs):
    ActionLog.objects.create(user=instance.user, action="Booking Deleted", details=f"Booking id: {instance.id}")
