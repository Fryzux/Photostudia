from django.contrib import admin
from .models import Hall, Booking, Order, Payment
from .services import BookingService
from django.core.exceptions import ValidationError
from django.contrib import messages

@admin.register(Hall)
class HallAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'price_per_hour')
    search_fields = ('name',)

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'hall', 'user', 'start_time', 'end_time')
    list_filter = ('hall', 'start_time')
    
    def save_model(self, request, obj, form, change):
        if not change:  # Only for new bookings
            try:
                BookingService.create_booking(
                    user=obj.user,
                    hall=obj.hall,
                    start_time=obj.start_time,
                    end_time=obj.end_time
                )
            except ValidationError as e:
                messages.error(request, f"Ошибка бронирования: {e.message}")
                # We don't call super().save_model here to prevent double saving or saving invalid data
            except Exception as e:
                messages.error(request, f"Системная ошибка: {str(e)}")
        else:
            super().save_model(request, obj, form, change)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'booking', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'method', 'is_successful', 'created_at')
    list_filter = ('method', 'is_successful')
