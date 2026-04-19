from django.core.management.base import BaseCommand
from studio.models import Hall
from decimal import Decimal

INITIAL_HALLS = [
    {
        'name': 'Циклорама',
        'description': 'Светлый зал с чистым фоном для каталогов, портретов, кампейнов и съёмок на ровном белом фоне. Идеально подходит для коммерческой фотографии.',
        'capacity': 10,
        'price_per_hour': Decimal('3500.00'),
    },
    {
        'name': 'Интерьерный зал',
        'description': 'Спокойный интерьер для lifestyle, семейных съёмок, брендов и кадров с живой фактурой пространства. Мягкая мебель и продуманный декор.',
        'capacity': 8,
        'price_per_hour': Decimal('4500.00'),
    },
    {
        'name': 'Лофт',
        'description': 'Просторный зал с большими окнами и индустриальным характером для lookbook, видео и командных съёмок. Фактурные стены и много воздуха.',
        'capacity': 20,
        'price_per_hour': Decimal('5500.00'),
    },
]


class Command(BaseCommand):
    help = 'Create initial halls if they do not exist yet.'

    def handle(self, *args, **options):
        created = 0
        for hall_data in INITIAL_HALLS:
            _, was_created = Hall.objects.get_or_create(
                name=hall_data['name'],
                defaults=hall_data,
            )
            if was_created:
                created += 1
                self.stdout.write(f'  Created: {hall_data["name"]}')

        if created:
            self.stdout.write(self.style.SUCCESS(f'✅ {created} hall(s) created.'))
        else:
            self.stdout.write('✅ All halls already exist, nothing to create.')
