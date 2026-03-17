from celery import shared_task
import time
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_booking_confirmation_email(booking_id: int, user_email: str):
    """
    Simulates sending an email in the background without blocking the API request.
    In a real app, this would use django.core.mail.send_mail.
    """
    logger.info(f"Starting email dispatch for booking {booking_id} to {user_email}...")
    
    # Simulate a slow network process (e.g., SMTP server connection)
    time.sleep(3)
    
    logger.info(f"Email successfully sent to {user_email} for booking {booking_id}!")
    return f"Success: {booking_id} -> {user_email}"

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
