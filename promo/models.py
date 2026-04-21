from django.db import models
from django.conf import settings
from studio.models import Hall
import random
import string


def generate_promo_code():
    """Генерирует уникальный промокод вида HALL-WED-30-XXXX"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"PROMO-{suffix}"


class PromoCode(models.Model):
    code = models.CharField(max_length=32, unique=True, default=generate_promo_code)
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='promo_codes')
    discount_percent = models.PositiveIntegerField(default=30, help_text='Скидка в процентах (1-100)')
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    hour_from = models.IntegerField(default=9, help_text='Начало действия скидки (час, 0-23)')
    hour_to = models.IntegerField(default=21, help_text='Конец действия скидки (час, 0-23)')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_promos'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} — {self.hall.name} ({self.discount_percent}%)"
