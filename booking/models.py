from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

class User(AbstractUser):
    phone = models.CharField(max_length=20, blank=True, null=True)
    
    def __str__(self):
        return self.username

class Hall(models.Model):
    name = models.CharField(max_length=100)
    price_per_hour = models.DecimalField(max_digits=10, decimal_places=2)
    capacity = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='halls/', blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.capacity} чел.)"

class Booking(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookings')
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='bookings')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Бронь {self.id}: {self.hall.name} ({self.user.username})"

class Order(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Ожидает оплаты'),
        ('PAID', 'Оплачено'),
        ('CANCELLED', 'Отменено'),
    ]
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='order')
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Заказ #{self.id} для Брони #{self.booking.id} ({self.status})"

class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50) # карта, наличные и т.д.
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Оплата {self.amount} для Заказа {self.order.id}"

class ActionLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action}"
