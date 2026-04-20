from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class AiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai'

    def ready(self):
        """Preload ML models at server startup so first request is fast."""
        # Skip during migrations, tests, or management commands that don't need ML
        import sys
        if any(cmd in sys.argv for cmd in ('migrate', 'makemigrations', 'collectstatic', 'shell')):
            return

        try:
            from ai.services import AIService
            AIService.load_model()
            logger.info('✅ AI daily model loaded at startup.')
        except FileNotFoundError:
            logger.warning('⚠️  AI daily model not found. Run: python ai/scripts/train_model.py')
        except Exception as e:
            logger.error('❌ Failed to load AI daily model: %s', e)

        try:
            from ai.services import AIService
            AIService.load_hourly_model()
            logger.info('✅ AI hourly model loaded at startup.')
        except FileNotFoundError:
            logger.warning('⚠️  AI hourly model not found. Run: python manage.py train_hourly_model')
        except Exception as e:
            logger.error('❌ Failed to load AI hourly model: %s', e)
