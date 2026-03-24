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
    """
    Finds all PENDING orders older than 24 hours and marks them as CANCELLED.
    """
    from datetime import timedelta
    from django.utils import timezone
    from studio.models import Order
    
    threshold_time = timezone.now() - timedelta(hours=24)
    old_orders = Order.objects.filter(status='PENDING', created_at__lte=threshold_time)
    
    count = old_orders.count()
    if count > 0:
        old_orders.update(status='CANCELLED')
        logger.info(f"Automatically cancelled {count} unpaid orders older than 24 hours.")
    else:
        logger.info("No old unpaid orders found to cancel.")
    
    return f"Cancelled {count} orders"
