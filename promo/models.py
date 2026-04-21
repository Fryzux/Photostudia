from django.db import models


class PromoCode(models.Model):
    PROMO_TYPE_CHOICES = (
        ('PERCENT', 'Percent'),
        ('FIXED', 'Fixed'),
    )

    code = models.CharField(max_length=32, unique=True)
    description = models.CharField(max_length=255, blank=True)
    discount_percent = models.PositiveSmallIntegerField()
    promo_type = models.CharField(max_length=10, choices=PROMO_TYPE_CHOICES, default='PERCENT')
    value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expiry = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} ({self.discount_percent}%)'
