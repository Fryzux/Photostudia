import json

from channels.generic.websocket import AsyncWebsocketConsumer


class OrderStatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.room_group_name = f'order_{self.order_id}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def order_status_update(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    'type': 'order_status_update',
                    'order_id': event['order_id'],
                    'status': event['status'],
                }
            )
        )
