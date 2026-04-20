from django.contrib import admin
from .models import Hall, Booking, Order, Payment, AuditLog

@admin.register(Hall)
class BookingHallAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'price_per_hour')

@admin.register(Booking)
class BookingBookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'hall', 'user', 'start_time', 'end_time', 'status')

@admin.register(Order)
class BookingOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'total_price', 'status')

@admin.register(Payment)
class BookingPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'payment_method')

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action')
