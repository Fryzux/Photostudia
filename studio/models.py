from django.db import models
from django.conf import settings
from django.db.models import F, Q


class StudioService(models.Model):
    PRICING_MODE_CHOICES = (
        ('fixed', 'Fixed'),
        ('hourly', 'Hourly'),
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    pricing_mode = models.CharField(max_length=10, choices=PRICING_MODE_CHOICES, default='fixed')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Hall(models.Model):
    name = models.CharField(max_length=100, unique=True, null=False)
    description = models.TextField(null=True, blank=True)
    capacity = models.PositiveIntegerField()
    price_per_hour = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='halls/', null=True, blank=True)

    def __str__(self):
        return self.name


class HallImage(models.Model):
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='halls/gallery/')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.hall.name} image #{self.id}'


class Booking(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookings')
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='bookings')
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(end_time__gt=F('start_time')),
                name='check_start_before_end'
            ),
        ]

    def __str__(self):
        return f"Booking {self.hall.name} from {self.start_time} to {self.end_time} by {self.user}"

class Order(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=False)
    applied_promo = models.ForeignKey('promo.PromoCode', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.id} - {self.status}"

class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=False)
    method = models.CharField(max_length=50)
    is_successful = models.BooleanField(default=False)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for Order {self.order.id} - {'Success' if self.is_successful else 'Failed'}"
