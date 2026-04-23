from django.core.management.base import BaseCommand
from studio.models import StudioService
from decimal import Decimal

INITIAL_SERVICES = [
    {
        'name': 'Набор реквизита',
        'description': 'Полный набор из 10 предметов: рамки, зеркала, ткани, аксессуары и другое',
        'price': Decimal('500.00'),
        'pricing_mode': 'fixed',
    },
    {
        'name': 'Аренда освещения',
        'description': 'Профессиональное студийное освещение с регулировкой и софтбоксами',
        'price': Decimal('600.00'),
        'pricing_mode': 'hourly',
    },
    {
        'name': 'Комплект света Profoto',
        'description': 'Комплект из 3 вспышек Profoto с модификаторами и розетками',
        'price': Decimal('1500.00'),
        'pricing_mode': 'fixed',
    },
    {
        'name': 'Визажист',
        'description': 'Профессиональный визажист для съёмки — макияж и укладка на весь сеанс',
        'price': Decimal('3000.00'),
        'pricing_mode': 'fixed',
    },
    {
        'name': 'Аренда костюмов',
        'description': 'Аренда сценических нарядов, платьев и аксессуаров из нашего гардероба',
        'price': Decimal('800.00'),
        'pricing_mode': 'hourly',
    },
    {
        'name': 'Фотограф-ассистент',
        'description': 'Помощник фотографа для работы со светом и оборудованием во время backstage',
        'price': Decimal('2500.00'),
        'pricing_mode': 'hourly',
    },
    {
        'name': 'Постобработка фото',
        'description': 'Профессиональная ретушь до 20 фото — цвет и текстура за 3 дня',
        'price': Decimal('5000.00'),
        'pricing_mode': 'fixed',
    },
]


class Command(BaseCommand):
    help = 'Create initial studio services if they do not exist yet.'

    def handle(self, *args, **options):
        created = 0
        for data in INITIAL_SERVICES:
            _, was_created = StudioService.objects.get_or_create(
                name=data['name'],
                defaults=data,
            )
            if was_created:
                created += 1
                self.stdout.write(f'  Created: {data["name"]}')

        if created:
            self.stdout.write(self.style.SUCCESS(f'✅ {created} service(s) created.'))
        else:
            self.stdout.write('✅ All services already exist, nothing to create.')
