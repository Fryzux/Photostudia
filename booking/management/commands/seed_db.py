import random
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from studio.models import Hall, Booking, Order, Payment
from audit.models import ActionLog

User = get_user_model()


class Command(BaseCommand):
    help = 'Наполнение базы тестовыми данными'

    def handle(self, *args, **kwargs):
        # 1. Создание пользователей
        admin, _ = User.objects.get_or_create(username='admin', defaults={'is_staff': True, 'is_superuser': True, 'phone': '+79001112233'})
        admin.set_password('admin123')
        admin.save()

        client, _ = User.objects.get_or_create(username='client', defaults={'is_staff': False, 'phone': '+79998887766'})
        client.set_password('client123')
        client.save()

        # 2. Создание залов
        halls_data = [
            {'name': 'Малый зал (Портретный)', 'price_per_hour': 500, 'capacity': 2, 'description': 'Идеально для портретов'},
            {'name': 'Средний зал (Семейный)', 'price_per_hour': 1500, 'capacity': 10, 'description': 'Для семейных фотосессий'},
            {'name': 'Большой зал (Циклорама)', 'price_per_hour': 3000, 'capacity': 50, 'description': 'Профессиональная циклорама для рекламы'},
        ]
        halls = []
        for h_data in halls_data:
            hall, _ = Hall.objects.get_or_create(name=h_data['name'], defaults=h_data)
            halls.append(hall)

        # 3. Создание истории бронирований и заказов за последние 2 года (730 дней)
        now = timezone.now()
        start_history = now - timedelta(days=730)

        self.stdout.write('Генерация истории бронирований за 2 года...')

        for i in range(1000):  # Генерируем 1000 записей
            hall = random.choice(halls)
            days_ago = random.randint(0, 729)
            hour = random.randint(9, 20)
            start_time = start_history + timedelta(days=days_ago, hours=hour)
            duration_hours = random.randint(1, 4)
            end_time = start_time + timedelta(hours=duration_hours)

            # Проверка на наложение (простая версия для сида)
            if not Booking.objects.filter(hall=hall, start_time__lt=end_time, end_time__gt=start_time).exists():
                booking = Booking.objects.create(
                    user=client,
                    hall=hall,
                    start_time=start_time,
                    end_time=end_time
                )

                total_amount = Decimal(hall.price_per_hour) * Decimal(duration_hours)
                order_status = 'COMPLETED' if days_ago > 2 else random.choice(['COMPLETED', 'PENDING'])
                order = Order.objects.create(
                    user=client,
                    booking=booking,
                    total_amount=total_amount,
                    final_amount=total_amount,
                    status=order_status
                )

                if order_status == 'COMPLETED':
                    Payment.objects.create(
                        order=order,
                        amount=total_amount,
                        method=random.choice(['card', 'cash', 'online']),
                        is_successful=True,
                    )

        # 4. Лог действий
        ActionLog.objects.create(
            user=admin,
            action="База данных инициализирована и наполнена по ТЗ 2026",
            details="total_records: 1000",
        )

        self.stdout.write(self.style.SUCCESS('База данных успешно наполнена данными!'))
        self.stdout.write('Админ: admin / admin123')
        self.stdout.write('Клиент: client / client123')
