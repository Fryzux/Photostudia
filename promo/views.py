from rest_framework import views, generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from .models import PromoCode
from .serializers import PromoCodeSerializer, PromoCodeCreateSerializer, PromoValidateSerializer


class IsManagerOrAdmin(permissions.BasePermission):
    """Разрешает доступ только менеджерам и администраторам."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_manager or request.user.is_staff)
        )


class PromoCodeListCreateView(views.APIView):
    """
    GET  /api/promo/  — список активных промокодов (публичный)
    POST /api/promo/  — создать промокод (только менеджер/админ)
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsManagerOrAdmin()]

    def get(self, request):
        now = timezone.now()
        hall_id = request.query_params.get('hall_id')
        qs = PromoCode.objects.filter(is_active=True, valid_from__lte=now, valid_to__gte=now)
        if hall_id:
            qs = qs.filter(hall_id=hall_id)
        serializer = PromoCodeSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PromoCodeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo = serializer.save(created_by=request.user)
        return Response(PromoCodeSerializer(promo).data, status=status.HTTP_201_CREATED)


class PromoCodeValidateView(views.APIView):
    """
    POST /api/promo/validate/  — проверить промокод и вернуть размер скидки
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PromoValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code']
        hall_id = serializer.validated_data['hall_id']
        start_time = serializer.validated_data['start_time']

        now = timezone.now()
        try:
            promo = PromoCode.objects.get(
                code=code,
                hall_id=hall_id,
                is_active=True,
                valid_from__lte=now,
                valid_to__gte=now,
                hour_from__lte=start_time.hour,
                hour_to__gt=start_time.hour,
            )
        except PromoCode.DoesNotExist:
            return Response({'valid': False, 'error': 'Промокод недействителен или не подходит для этого слота.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'valid': True,
            'discount_percent': promo.discount_percent,
            'code': promo.code,
        })


class PromoCodeDeactivateView(views.APIView):
    """
    PATCH /api/promo/{id}/deactivate/  — деактивировать промокод
    """
    permission_classes = [IsManagerOrAdmin]

    def patch(self, request, pk):
        try:
            promo = PromoCode.objects.get(pk=pk)
        except PromoCode.DoesNotExist:
            return Response({'error': 'Промокод не найден.'}, status=status.HTTP_404_NOT_FOUND)
        promo.is_active = False
        promo.save()
        return Response(PromoCodeSerializer(promo).data)


class PromoCodeActivateView(views.APIView):
    """
    PATCH /api/promo/{id}/activate/  — активировать промокод
    """
    permission_classes = [IsManagerOrAdmin]

    def patch(self, request, pk):
        try:
            promo = PromoCode.objects.get(pk=pk)
        except PromoCode.DoesNotExist:
            return Response({'error': 'Промокод не найден.'}, status=status.HTTP_404_NOT_FOUND)
        promo.is_active = True
        promo.save()
        return Response(PromoCodeSerializer(promo).data)
