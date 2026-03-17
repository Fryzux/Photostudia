import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('photostudia')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

from celery.schedules import crontab

app.conf.beat_schedule = {
    'cancel-unpaid-orders-every-hour': {
        'task': 'studio.tasks.cancel_unpaid_orders',
        'schedule': crontab(minute=0), # Runs at minute 0 of every hour
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
