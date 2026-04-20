from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class TwoFactorTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Расширенный сериализатор логина:
    - Если у пользователя включена 2FA → требует поле totp_code
    - Если 2FA выключена → работает как обычно
    """
    totp_code = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        # Стандартная проверка логина/пароля
        data = super().validate(attrs)

        user = self.user
        if user.is_2fa_enabled:
            totp_code = attrs.get('totp_code', '').strip()
            if not totp_code:
                raise AuthenticationFailed(
                    {'requires_2fa': True, 'detail': 'Введите код из приложения аутентификации.'},
                    code='requires_2fa',
                )
            import pyotp
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(totp_code, valid_window=1):
                raise AuthenticationFailed(
                    {'requires_2fa': True, 'detail': 'Неверный код 2FA.'},
                    code='invalid_2fa_code',
                )

        return data

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name', 'phone')
        extra_kwargs = {
            'first_name': {'required': True},
            'email': {'required': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', '')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone', 'is_staff', 'is_superuser', 'is_manager', 'date_joined')
        read_only_fields = ('is_staff', 'is_superuser', 'is_manager', 'date_joined')
        ref_name = 'CoreUserSerializer'
