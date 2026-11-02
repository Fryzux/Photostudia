from rest_framework import viewsets, views, generics, permissions
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from datetime import datetime, time, timedelta
from django.db.models import Count, Q, Sum
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils.cache import patch_cache_control, patch_vary_headers
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, NumberFilter
from django.utils import timezone
import os
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)
from .models import Booking, HallImage, Order, Payment, Hall, StudioService
from .serializers import BookingSerializer, OrderSerializer, PaymentSerializer, PaymentCreateSerializer, HallSerializer, OrderStatusUpdateSerializer, StudioServiceSerializer
from .services import BookingService, PaymentService, BookingConflictError
from . import cache as studio_cache


def cacheable_response(request, data, max_age=60):
    """Response for public catalog data: browsers may reuse it for max_age seconds."""
    response = Response(data)
    if request.user and request.user.is_authenticated:
        patch_cache_control(response, private=True, max_age=max_age)
    else:
        patch_cache_control(response, public=True, max_age=max_age)
    patch_vary_headers(response, ['Authorization'])
    return response


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Anybody can read (GET, HEAD, OPTIONS).
    Only staff/admin users can write (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_staff


class HallFilter(FilterSet):
    """Custom filters for halls endpoint."""
    price_min = NumberFilter(field_name='price_per_hour', lookup_expr='gte')
    price_max = NumberFilter(field_name='price_per_hour', lookup_expr='lte')
    capacity_min = NumberFilter(field_name='capacity', lookup_expr='gte')

    class Meta:
        model = Hall
        fields = ['price_min', 'price_max', 'capacity_min']


class HallViewSet(viewsets.ModelViewSet):
    """
    CRUD for /api/halls/

    - GET /api/halls/         → list all halls (any authenticated user)
    - POST /api/halls/        → create a hall (admin only)
    - GET /api/halls/{id}/    → retrieve a hall (any authenticated user)
    - PUT/PATCH /api/halls/{id}/ → update a hall (admin only)
    - DELETE /api/halls/{id}/ → delete a hall (admin only)

    Filtering:
      ?price_min=500&price_max=2000&capacity_min=5
      ?search=студия

    Availability:
      GET /api/studio/halls/{id}/availability/?date=2026-03-20
    """
    queryset = Hall.objects.prefetch_related('gallery_images').order_by('name')
    serializer_class = HallSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = HallFilter
    search_fields = ['name']

    def list(self, request, *args, **kwargs):
        host, query = studio_cache.request_fingerprint(request)
        key = studio_cache.make_key('halls:list', host, query, deps=('halls',))
        data = studio_cache.get_or_set(
            key, lambda: super(HallViewSet, self).list(request, *args, **kwargs).data, studio_cache.TTL_CATALOG)
        return cacheable_response(request, data)

    def retrieve(self, request, *args, **kwargs):
        host, _ = studio_cache.request_fingerprint(request)
        key = studio_cache.make_key('halls:detail', kwargs.get('pk'), host, deps=('halls',))
        data = studio_cache.get_or_set(
            key, lambda: super(HallViewSet, self).retrieve(request, *args, **kwargs).data, studio_cache.TTL_CATALOG)
        return cacheable_response(request, data)

    @action(detail=True, methods=['post'], url_path='images',
            permission_classes=[IsAuthenticated], parser_classes=[MultiPartParser, FormParser])
    def upload_images(self, request, pk=None):
        """
        POST /api/halls/{id}/images/  — загрузить изображения в галерею зала.
        Принимает form-data с полем 'images' (одно или несколько файлов).
        """
        hall = self.get_object()
        if not request.user.is_staff:
            return Response({'error': 'Нет прав доступа.'}, status=status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist('images') or request.FILES.getlist('image')
        if not files:
            return Response({'error': 'Файлы не переданы.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for file in files:
            img = HallImage.objects.create(hall=hall, image=file)
            created.append(img.image.url)

        # Обновляем главное изображение если оно ещё не установлено
        if not hall.image and files:
            hall.image = files[0]
            hall.save(update_fields=['image'])

        serializer = self.get_serializer(hall)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='availability', permission_classes=[permissions.AllowAny])
    def availability(self, request, pk=None):
        """
        GET /api/studio/halls/{id}/availability/?date=YYYY-MM-DD
        Returns a list of booked time slots for the given hall on the given date.
        """
        from datetime import datetime, date as date_type
        from django.utils.timezone import make_aware

        date_str = request.query_params.get('date')

        if not date_str:
            return Response(
                {"error": "Validation Error", "details": "The 'date' query parameter is required (e.g. ?date=2026-03-20)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {"error": "Validation Error", "details": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        def build():
            hall = self.get_object()
            day_start = make_aware(datetime.combine(target_date, time.min))
            day_end = day_start + timedelta(days=1)
            # Overlap with the whole day, so bookings crossing midnight are included
            bookings = list(Booking.objects.filter(
                hall=hall,
                start_time__lt=day_end,
                end_time__gt=day_start,
            ).order_by('start_time').only('start_time', 'end_time'))

            # Generate hourly slots from 09:00 to 21:00
            slots = []
            for hour in range(9, 21):
                start_dt = datetime.combine(target_date, time(hour, 0))
                end_dt = datetime.combine(target_date, time(hour + 1, 0))

                # Check if this slot overlaps with any booking
                is_available = not any(
                    b.start_time < make_aware(end_dt) and b.end_time > make_aware(start_dt)
                    for b in bookings
                )

                slots.append({
                    "start": start_dt.time().isoformat(),
                    "end": end_dt.time().isoformat(),
                    "available": is_available
                })

            return {
                "hall_id": hall.id,
                "hall_name": hall.name,
                "date": date_str,
                "slots": slots,
                "is_fully_free": len(bookings) == 0,
            }

        hall_key = int(pk) if str(pk).isdigit() else pk
        key = studio_cache.make_key('avail', hall_key, target_date.isoformat(), deps=(f'bookings:{hall_key}', 'halls'))
        return Response(studio_cache.get_or_set(key, build, studio_cache.TTL_AVAILABILITY))


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling GET, POST, PATCH, DELETE for /api/bookings/
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['hall', 'start_time']

    def get_permissions(self):
        # Moving a booking does not recalculate its order, so customers must not change it themselves.
        if self.action in ('update', 'partial_update'):
            return [permissions.IsAdminUser()]
        return super().get_permissions()

    def get_queryset(self):
        # Admin can see all, user can see only theirs
        qs = Booking.objects.select_related('hall', 'user').prefetch_related('hall__gallery_images')
        if self.request.user.is_staff:
            return qs
        return qs.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        promo_code = serializer.validated_data.pop('promo_code', None)
        extra_services_total = request.data.get('extra_services_total')

        # Service layer orchestrates atomic creation and overlap check
        try:
            booking, order, applied_promo = BookingService.create_booking(
                user=request.user,
                hall=serializer.validated_data['hall'],
                start_time=serializer.validated_data['start_time'],
                end_time=serializer.validated_data['end_time'],
                promo_code=promo_code or None,
                extra_services_total=extra_services_total,
            )
        except BookingConflictError as e:
            return Response(
                {"error": "Конфликт бронирования", "details": str(e)},
                status=status.HTTP_409_CONFLICT
            )
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        
        # Trigger background task
        from .tasks import send_booking_confirmation_email
        try:
            send_booking_confirmation_email.delay(booking.id, request.user.email)
        except Exception as exc:
            logger.warning("Celery broker is unavailable, sending booking email synchronously: %s", exc)
            send_booking_confirmation_email(booking.id, request.user.email)
        
        result_serializer = self.get_serializer(booking)
        data = result_serializer.data
        data['order_id'] = order.id
        data['total_amount'] = str(order.total_amount)
        if applied_promo:
            data['promo_applied'] = applied_promo
        return Response(data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except BookingConflictError as e:
            return Response(
                {"error": "Конфликт бронирования", "details": str(e)},
                status=status.HTTP_409_CONFLICT
            )

    def perform_update(self, serializer):
        booking = serializer.instance
        data = serializer.validated_data
        BookingService.update_booking(
            booking,
            data.get('hall', booking.hall),
            data.get('start_time', booking.start_time),
            data.get('end_time', booking.end_time),
        )

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

class AnalyticsSummaryView(views.APIView):
    """
    Endpoint for /api/analytics/summary/
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get a summary of analytics. Admin gets global stats, users get their own.",
        responses={
            200: openapi.Response(
                description="Analytics summary",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'total_orders': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_bookings': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_revenue': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'total_users': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_halls': openapi.Schema(type=openapi.TYPE_INTEGER),
                    }
                )
            )
        }
    )
    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # Order count and revenue in one query instead of two
        order_totals = dict(
            total_orders=Count('id'),
            total_revenue=Sum('total_amount', filter=Q(status='COMPLETED')),
        )

        if not request.user.is_staff:
            def build():
                orders = Order.objects.filter(user=request.user).aggregate(**order_totals)
                return {
                    "total_orders": orders['total_orders'],
                    "total_bookings": Booking.objects.filter(user=request.user).count(),
                    "total_revenue": float(orders['total_revenue'] or 0),
                }
            key = studio_cache.make_key('analytics:user', request.user.id, deps=('bookings', 'orders'))
        else:
            def build():
                orders = Order.objects.aggregate(**order_totals)
                return {
                    "total_orders": orders['total_orders'],
                    "total_bookings": Booking.objects.count(),
                    "total_revenue": float(orders['total_revenue'] or 0),
                    "total_users": User.objects.count(),
                    "total_halls": Hall.objects.count(),
                }
            key = studio_cache.make_key('analytics:admin', deps=('bookings', 'orders', 'halls'))

        return Response(studio_cache.get_or_set(key, build, studio_cache.TTL_ANALYTICS))


class OrderListView(generics.ListAPIView):
    """
    GET /api/orders/ — list orders for the current user (admin sees all).
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status']

    def get_queryset(self):
        # gallery_images prefetch removes the per-order query from HallSerializer.get_images (N+1)
        qs = (Order.objects
              .select_related('booking__hall', 'user', 'applied_promo')
              .prefetch_related('booking__hall__gallery_images')
              .order_by('-created_at'))
        if self.request.user.is_staff:
            return qs
        return qs.filter(user=self.request.user)


class OrderStatusUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/orders/{id}/status/ — update order status (admin only).
    """
    queryset = Order.objects.select_related('booking__hall', 'user').all()
    serializer_class = OrderStatusUpdateSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_update(self, serializer):
        order = serializer.save()
        
        # Broadcast the new status to the WebSocket group
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'order_{order.id}',
            {
                'type': 'order_status_update',
                'order_id': order.id,
                'status': order.status
            }
        )


class PaymentCreateView(views.APIView):
    """
    POST /api/payments/ — pay for a pending order.

    Request body:
      - order_id (int): ID of the pending Order to pay for.
      - method (str): Payment method — 'card', 'cash', or 'online'.

    Returns the created Payment object with full order details.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Pay for a pending order.",
        request_body=PaymentCreateSerializer,
        responses={
            201: PaymentSerializer(),
            400: "Invalid method or order already paid",
            403: "Cannot pay for another user's order",
            404: "Order not found"
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = serializer.validated_data['order']

        # Ownership check — user can only pay for their own orders
        if order.user != request.user and not request.user.is_staff:
            return Response(
                {"error": "You do not have permission to pay for this order."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            payment = PaymentService.process_payment(
                order=order,
                amount=order.total_amount,
                method=serializer.validated_data['method'],
                promo_code=serializer.validated_data.get('promo_code'),
            )
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response(
                {"error": msg},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Broadcast the PAID status to the WebSocket group
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'order_{order.id}',
            {
                'type': 'order_status_update',
                'order_id': order.id,
                'status': order.status
            }
        )

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED
        )


class StudioServiceViewSet(viewsets.ModelViewSet):
    """
    CRUD для услуг фотостудии.
    GET — доступен всем. POST/PATCH/PUT/DELETE — только staff/admin.
    """
    queryset = StudioService.objects.all()
    serializer_class = StudioServiceSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        # Обычные пользователи видят только активные услуги
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    def list(self, request, *args, **kwargs):
        _, query = studio_cache.request_fingerprint(request)
        is_staff = bool(request.user and request.user.is_staff)
        key = studio_cache.make_key('services:list', is_staff, query, deps=('services',))
        data = studio_cache.get_or_set(
            key, lambda: super(StudioServiceViewSet, self).list(request, *args, **kwargs).data,
            studio_cache.TTL_CATALOG)
        return cacheable_response(request, data)
