from django.db import models


class PromoCode(models.Model):
    code = models.CharField(max_length=32, unique=True)
    description = models.CharField(max_length=255, blank=True)
    discount_percent = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True, db_index=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} ({self.discount_percent}%)'
