from decimal import Decimal

from django.db import migrations


DEFAULT_HALLS = [
    {
        'name': 'Циклорама',
        'capacity': 6,
        'price_per_hour': Decimal('3500.00'),
    },
    {
        'name': 'Интерьерный зал',
        'capacity': 8,
        'price_per_hour': Decimal('4500.00'),
    },
    {
        'name': 'Лофт',
        'capacity': 10,
        'price_per_hour': Decimal('5500.00'),
    },
]


def seed_halls(apps, schema_editor):
    Hall = apps.get_model('studio', 'Hall')

    for hall in DEFAULT_HALLS:
        Hall.objects.get_or_create(
            name=hall['name'],
            defaults={
                'capacity': hall['capacity'],
                'price_per_hour': hall['price_per_hour'],
            },
        )


def unseed_halls(apps, schema_editor):
    Hall = apps.get_model('studio', 'Hall')
    Hall.objects.filter(name__in=[hall['name'] for hall in DEFAULT_HALLS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('studio', '0003_hall_image'),
    ]

    operations = [
        migrations.RunPython(seed_halls, unseed_halls),
    ]
