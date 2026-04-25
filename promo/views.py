from rest_framework import views, generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from decimal import Decimal
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
        hall_id = request.query_params.get('hall_id')
        is_admin = request.user and request.user.is_authenticated and (
            request.user.is_staff or getattr(request.user, 'is_manager', False)
        )

        if is_admin:
            # Администратор/менеджер видит все промокоды
            qs = PromoCode.objects.all()
        else:
            # Обычный пользователь видит только активные и в срок
            now = timezone.now()
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
        order_id = serializer.validated_data['order_id']

        # Импортируем Order здесь чтобы избежать циклических импортов
        from studio.models import Order
        try:
            order = Order.objects.select_related('booking__hall').get(pk=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Заказ не найден.'}, status=status.HTTP_404_NOT_FOUND)

        booking = order.booking
        hall_id = booking.hall_id
        start_time = booking.start_time

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
            return Response(
                {'error': 'Промокод недействителен или не подходит для этого слота.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        base_total = order.total_amount
        discount_amount = (base_total * Decimal(promo.discount_percent) / Decimal(100)).quantize(Decimal('0.01'))
        final_total = base_total - discount_amount

        return Response({
            'promo': PromoCodeSerializer(promo).data,
            'order_id': order_id,
            'base_total': str(base_total),
            'discount_amount': str(discount_amount),
            'final_total': str(final_total),
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
