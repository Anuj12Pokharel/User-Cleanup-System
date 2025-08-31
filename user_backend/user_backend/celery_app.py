import os
from celery import Celery
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'user_backend.settings')

app = Celery('user_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
app.conf.timezone = getattr(settings, 'TIME_ZONE', 'UTC')

app.conf.beat_schedule = {
    'cleanup-every-5-minutes': {
        'task': 'users.tasks.cleanup_inactive_users',
        'schedule': 300.0,  # seconds — 5 minutes
    },
}

# For debugging
@app.task(bind=True)
def debug_task(self):
    return f'Request: {self.request!r}'
