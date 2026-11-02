from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from . import cache as studio_cache
from .models import Booking, Hall, HallImage, Order, StudioService


@receiver([post_save, post_delete], sender=Hall)
@receiver([post_save, post_delete], sender=HallImage)
def invalidate_halls(sender, **kwargs):
    studio_cache.bump('halls')


@receiver([post_save, post_delete], sender=StudioService)
def invalidate_services(sender, **kwargs):
    studio_cache.bump('services')


@receiver([post_save, post_delete], sender=Booking)
def invalidate_bookings(sender, instance, **kwargs):
    studio_cache.bump(f'bookings:{instance.hall_id}', 'bookings')


@receiver([post_save, post_delete], sender=Order)
def invalidate_orders(sender, **kwargs):
    studio_cache.bump('orders')
