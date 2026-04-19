import json
from channels.generic.websocket import AsyncWebsocketConsumer

class HallAvailabilityConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.hall_group_name = 'hall_availability_updates'
        
        # Join room group
        await self.channel_layer.group_add(
            self.hall_group_name,
            self.channel_name
        )
        
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.hall_group_name,
            self.channel_name
        )

    # Receive message from room group
    async def availability_update(self, event):
        message = event['message']
        hall_id = event.get('hall_id')
        date = event.get('date')

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'availability_update',
            'message': message,
            'hall_id': hall_id,
            'date': date
        }))
