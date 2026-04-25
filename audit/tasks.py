from celery import shared_task
import requests
import logging
from core.security import validate_no_ssrf
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=5)
def send_webhook(self, url, payload):
    """
    Отправляет Webhook с защитой от SSRF и exponential backoff ретраями.
    """
    try:
        validated_url = validate_no_ssrf(url)
    except ValidationError as e:
        logger.error(f"SSRF Alert: attempt to send webhook to blocked URL {url}. Reason: {e}")
        return

    try:
        response = requests.post(validated_url, json=payload, timeout=5)
        response.raise_for_status()
        logger.info(f"Webhook sent successfully to {validated_url}")
    except requests.exceptions.RequestException as e:
        logger.warning(f"Webhook failed to {validated_url}. Retrying... Error: {e}")
        countdown = 2 ** self.request.retries
        self.retry(exc=e, countdown=countdown)
