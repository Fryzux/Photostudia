from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Booking

@receiver(post_save, sender=Booking)
def booking_saved(sender, instance, created, **kwargs):
    if created or instance.status == 'CANCELLED':
        # Send update to group
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'hall_availability_updates',
            {
                'type': 'availability_update',
                'message': 'slots_changed',
                'hall_id': instance.hall.id,
                'date': instance.start_time.date().isoformat()
            }
        )

@receiver(post_delete, sender=Booking)
def booking_deleted(sender, instance, **kwargs):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'hall_availability_updates',
        {
            'type': 'availability_update',
            'message': 'slots_changed',
            'hall_id': instance.hall.id,
            'date': instance.start_time.date().isoformat()
        }
    )
