import logging
import time

logger = logging.getLogger(__name__)

# HTTP методы, которые изменяют данные
MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Пути, которые не нужно логировать (служебные)
SKIP_PATHS = {
    '/api/auth/refresh/',
    '/api/docs/',
    '/api/redoc/',
    '/admin/',
    '/static/',
    '/media/',
}


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        if request.method in MUTATING_METHODS and not self._should_skip(request.path):
            self._log(request, response, duration_ms)

        return response

    def _should_skip(self, path: str) -> bool:
        for skip in SKIP_PATHS:
            if path.startswith(skip):
                return True
        return False

    def _log(self, request, response, duration_ms: int):
        user = request.user
        username = user.username if user and user.is_authenticated else 'anonymous'
        status_code = response.status_code

        action = f'{request.method} {request.path} → {status_code}'
        details = f'duration={duration_ms}ms ip={self._get_ip(request)}'

        # Не логируем успешный refresh токена и 4xx на login (не раскрываем попытки)
        if status_code == 401 and request.path == '/api/auth/login/':
            details += ' [failed_login]'

        try:
            from audit.models import ActionLog
            from django.contrib.auth import get_user_model
            User = get_user_model()

            user_obj = None
            if user and user.is_authenticated:
                try:
                    user_obj = User.objects.get(pk=user.pk)
                except User.DoesNotExist:
                    pass

            ActionLog.objects.create(
                user=user_obj,
                action=action,
                details=details,
            )
        except Exception as exc:
            # Никогда не ломаем запрос из-за ошибки логирования
            logger.warning('AuditMiddleware: failed to write log: %s', exc)

    @staticmethod
    def _get_ip(request) -> str:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
