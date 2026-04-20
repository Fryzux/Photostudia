from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .serializers import UserRegistrationSerializer, UserSerializer, TwoFactorTokenObtainPairSerializer

User = get_user_model()


class TwoFactorTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — логин с поддержкой 2FA."""
    serializer_class = TwoFactorTokenObtainPairSerializer


class TwoFactorSetupView(APIView):
    """POST /api/auth/2fa/setup/ — генерирует TOTP-секрет и QR URI."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.is_2fa_enabled:
            return Response({'detail': '2FA уже активна.'}, status=status.HTTP_400_BAD_REQUEST)
        import pyotp
        secret = pyotp.random_base32()
        user.pending_totp_secret = secret
        user.save(update_fields=['pending_totp_secret'])
        totp = pyotp.TOTP(secret)
        otpauth_url = totp.provisioning_uri(name=user.email or user.username, issuer_name='Photostudia')
        return Response({'otpauth_url': otpauth_url, 'secret': secret})


class TwoFactorVerifyView(APIView):
    """POST /api/auth/2fa/verify/ — подтверждает код и активирует 2FA."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import pyotp
        user = request.user
        code = request.data.get('code', '').strip()
        secret = user.pending_totp_secret
        if not secret:
            return Response({'detail': 'Сначала вызовите /api/auth/2fa/setup/.'}, status=status.HTTP_400_BAD_REQUEST)
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            return Response({'detail': 'Неверный код.'}, status=status.HTTP_400_BAD_REQUEST)
        user.totp_secret = secret
        user.pending_totp_secret = ''
        user.is_2fa_enabled = True
        user.save(update_fields=['totp_secret', 'pending_totp_secret', 'is_2fa_enabled'])
        return Response({'detail': '2FA успешно активирована.'})


class TwoFactorDisableView(APIView):
    """POST /api/auth/2fa/disable/ — отключает 2FA после проверки кода."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import pyotp
        user = request.user
        if not user.is_2fa_enabled:
            return Response({'detail': '2FA не активна.'}, status=status.HTTP_400_BAD_REQUEST)
        code = request.data.get('code', '').strip()
        if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
            return Response({'detail': 'Неверный код.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_2fa_enabled = False
        user.totp_secret = ''
        user.pending_totp_secret = ''
        user.save(update_fields=['is_2fa_enabled', 'totp_secret', 'pending_totp_secret'])
        return Response({'detail': '2FA отключена.'})

class RegisterView(generics.CreateAPIView):
    queryset = UserSerializer.Meta.model.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserRegistrationSerializer

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAdminUser,)


class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)
