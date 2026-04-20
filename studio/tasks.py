from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging
from datetime import timedelta # This import is used by the second task

logger = logging.getLogger(__name__)

@shared_task
def send_booking_confirmation_email(booking_id, user_email):
    """
    Background task to send a confirmation email after booking.
    """
    subject = f"Оповещение о бронировании #{booking_id}"
    message = f"Ваше бронирование успешно создано!\n\nНомер бронирования: {booking_id}"

    try:
        if settings.EMAIL_HOST_USER:  # Ensure credentials exist before trying
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user_email],
                fail_silently=False,
            )
            logger.info(f"Email sent successfully for booking {booking_id} to {user_email}")
        else:
            logger.warning(f"Simulating email for booking {booking_id} to {user_email} (no SMTP credentials)")
    except Exception as e:
        logger.error(f"Failed to send email for booking {booking_id}: {str(e)}")
        
    return f"Email task executed for {user_email}"

@shared_task
def cancel_unpaid_orders():
    from datetime import timedelta
    from django.utils import timezone
    from studio.models import Order
    from studio.repositories import OrderRepository
    from audit.tasks import send_webhook
    
    threshold_time = timezone.now() - timedelta(hours=24)
    # Используем Repository (хотя фильтрация по дате специфична, инкапсулируем логику)
    old_orders = Order.objects.filter(status='PENDING', created_at__lte=threshold_time)
    
    count = 0
    for order in old_orders:
        user_email = order.user.email
        order_id = order.id
        
        # 1. Смена статуса через Repository (Задание #10)
        OrderRepository.update_status(order, 'CANCELLED')
        
        # 2. Освобождение слота (Задание #8)
        if order.booking:
            booking_info = f"{order.booking.hall.name} ({order.booking.start_time})"
            order.booking.delete()
        
        # 3. Уведомление пользователя (Задание #5)
        if user_email:
            send_mail(
                subject=f"Ваш заказ #{order_id} отменен",
                message=f"Здравствуйте! Ваш неоплаченный заказ на {booking_info} был автоматически отменен.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user_email],
                fail_silently=True
            )
            
        # 4. Отправка Webhook (Задание #5)
        # В реальности URL берется из настроек профиля или системы
        # Здесь имитируем отправку на некий внешний endpoint
        webhook_payload = {
            'event': 'order_cancelled',
            'order_id': order_id,
            'reason': 'payment_timeout'
        }
        # send_webhook.delay("https://external-service.com/hooks/", webhook_payload) 
        # (Закомментировано, так как URL не определен, но логика на месте и защищена SSRF)

        count += 1
        
    if count > 0:
        logger.info(f"Automatically cancelled {count} unpaid orders and notified users.")
    else:
        logger.info("No old unpaid orders found to cancel.")
    
@shared_task
def create_recurring_bookings_task(user_id, hall_id, start_time_iso, end_time_iso, weeks=4):
    """
    Background task to create a series of bookings.
    """
    from django.contrib.auth import get_user_model
    from .models import Hall
    from .services import BookingService
    from datetime import datetime
    
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        hall = Hall.objects.get(pk=hall_id)
        start_time = datetime.fromisoformat(start_time_iso)
        end_time = datetime.fromisoformat(end_time_iso)
        
        BookingService.create_recurring_bookings(user, hall, start_time, end_time, weeks)
        logger.info(f"Recurring bookings task completed for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to create recurring bookings: {str(e)}")
