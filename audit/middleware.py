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
        
        # If user is anonymous, try to identify via JWT token for auditing
        if not (user and user.is_authenticated):
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                try:
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    authenticator = JWTAuthentication()
                    validated_token = authenticator.get_validated_token(auth_header.split(' ')[1])
                    user = authenticator.get_user(validated_token)
                except Exception:
                    pass

        username = user.username if (user and user.is_authenticated) else 'anonymous'
        status_code = response.status_code

        action = f'{request.method} {request.path} -> {status_code}'
        details = f'duration={duration_ms}ms ip={self._get_ip(request)}'

        if status_code == 401 and request.path == '/api/auth/login/':
            details += ' [failed_login]'

        try:
            from audit.models import ActionLog
            from django.contrib.auth import get_user_model
            User = get_user_model()

            user_obj = None
            if user and user.is_authenticated:
                user_obj = user # request.user might be a different object type, but should be fine

            ActionLog.objects.create(
                user=user_obj if isinstance(user_obj, User) else None,
                action=action,
                details=details,
            )
        except Exception as exc:
            logger.warning('AuditMiddleware: failed to write log: %s', exc)

    @staticmethod
    def _get_ip(request) -> str:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
