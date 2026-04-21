from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend

from studio.models import Order
from .models import PromoCode
from .serializers import PromoCodeSerializer, PromoValidationSerializer
from .services import calculate_promo_for_amount, validate_promo


class PromoCodeViewSet(viewsets.ModelViewSet):
    """
    Admin-only promo management:
    - GET /api/promos/promocodes/
    - POST /api/promos/promocodes/
    - PATCH /api/promos/promocodes/{id}/
    - PATCH /api/promos/promocodes/{id}/deactivate/
    """
    queryset = PromoCode.objects.all()
    serializer_class = PromoCodeSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'description']

    @action(detail=True, methods=['patch'])
    def deactivate(self, request, pk=None):
        promo = self.get_object()
        promo.is_active = False
        promo.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(promo)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def activate(self, request, pk=None):
        promo = self.get_object()
        promo.is_active = True
        promo.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(promo)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='validate')
    def validate_code(self, request):
        serializer = PromoValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = get_object_or_404(Order, id=serializer.validated_data['order_id'])
        if order.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied', 'details': 'You cannot validate promo for this order.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        promo = get_object_or_404(PromoCode, code=serializer.validated_data['code'])
        try:
            validate_promo(promo)
            discount_amount, final_amount = calculate_promo_for_amount(promo, order.total_amount)
        except ValidationError as exc:
            return Response(
                {'error': 'Validation Error', 'details': exc.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'promo': PromoCodeSerializer(promo).data,
                'order_id': order.id,
                'base_total': order.total_amount,
                'discount_amount': discount_amount,
                'final_total': final_amount,
            },
            status=status.HTTP_200_OK,
        )
