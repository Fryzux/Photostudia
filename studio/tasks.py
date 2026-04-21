from celery import shared_task
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

@shared_task
def send_booking_confirmation_email(booking_id: int, user_email: str):
    """
    Sends a booking confirmation email in the background.
    Falls back to logging when SMTP credentials are not configured.
    """
    subject = f"Booking confirmation #{booking_id}"
    message = (
        "Your booking was created successfully.\n\n"
        f"Booking number: {booking_id}"
    )

    try:
        if settings.EMAIL_HOST_USER:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user_email],
                fail_silently=False,
            )
            logger.info("Email sent successfully for booking %s to %s", booking_id, user_email)
        else:
            logger.warning(
                "Skipping real email for booking %s to %s because SMTP credentials are missing",
                booking_id,
                user_email,
            )
    except Exception as exc:
        logger.error("Failed to send email for booking %s: %s", booking_id, exc)

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
