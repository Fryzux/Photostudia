from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import PromoCode
from .serializers import PromoCodeSerializer


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
