from rest_framework import viewsets, views, generics, permissions
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from datetime import datetime, time, timedelta
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, NumberFilter
from django.utils import timezone
import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from .models import Booking, HallImage, Order, Payment, Hall
from .serializers import BookingSerializer, OrderSerializer, PaymentSerializer, PaymentCreateSerializer, HallSerializer, OrderStatusUpdateSerializer
from .services import BookingService, PaymentService
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


def get_studio_timezone():
    """
    Returns timezone used for booking-grid rendering in availability endpoint.
    Defaults to Europe/Moscow (project domain), can be overridden by STUDIO_TIME_ZONE.
    """
    tz_name = os.environ.get('STUDIO_TIME_ZONE') or getattr(settings, 'STUDIO_TIME_ZONE', None) or 'Europe/Moscow'
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        logger.warning("Unknown STUDIO_TIME_ZONE=%s, fallback to Django current timezone.", tz_name)
        return timezone.get_current_timezone()


def broadcast_order_status_update(order: Order) -> None:
    """
    Sends realtime status update to order websocket group.
    If channel layer (e.g. Redis) is unavailable, logs warning without breaking API flow.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'order_{order.id}',
            {
                'type': 'order_status_update',
                'order_id': order.id,
                'status': order.status,
            },
        )
    except Exception as exc:
        logger.warning('Realtime order update skipped for order %s: %s', order.id, exc)


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Anyone can read (GET, HEAD, OPTIONS).
    Only staff/admin users can write (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class HallFilter(FilterSet):
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
    """
    queryset = Hall.objects.all().order_by('name')
    serializer_class = HallSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = HallFilter
    search_fields = ['name']

    @action(
        detail=True,
        methods=['post'],
        url_path='images',
        permission_classes=[permissions.IsAdminUser],
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_images(self, request, pk=None):
        hall = self.get_object()
        files = request.FILES.getlist('images')
        if not files and request.FILES.get('image'):
            files = [request.FILES['image']]

        if not files:
            return Response(
                {'error': 'Validation Error', 'details': 'Attach at least one image file via image/images field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_images = int(os.environ.get('HALL_MAX_IMAGES', 10))
        max_image_size = int(os.environ.get('HALL_MAX_IMAGE_SIZE', 5 * 1024 * 1024))
        allowed_ext = {'.jpg', '.jpeg', '.png', '.webp'}

        existing_count = hall.gallery_images.count()
        if existing_count + len(files) > max_images:
            return Response(
                {
                    'error': 'Validation Error',
                    'details': f'Image limit exceeded. Current={existing_count}, adding={len(files)}, max={max_images}.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        for file in files:
            _, ext = os.path.splitext(file.name.lower())
            if ext not in allowed_ext:
                return Response(
                    {
                        'error': 'Validation Error',
                        'details': f'Unsupported image format: {file.name}. Allowed: jpg, jpeg, png, webp.',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if file.size > max_image_size:
                return Response(
                    {
                        'error': 'Validation Error',
                        'details': f'File {file.name} is too large (max {max_image_size // (1024 * 1024)} MB).',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            HallImage.objects.create(hall=hall, image=file)
            created += 1

        payload = HallSerializer(hall, context={'request': request}).data
        payload['uploaded'] = created
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='availability', permission_classes=[IsAuthenticated])
    def availability(self, request, pk=None):
        hall = self.get_object()
        date_str = request.query_params.get('date')

        if not date_str:
            return Response(
                {
                    'error': 'Validation Error',
                    'details': "The 'date' query parameter is required (for example ?date=2026-03-20).",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Validation Error', 'details': 'Invalid date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_open_hour = request.query_params.get('open_hour') or os.environ.get('BOOKING_OPEN_HOUR', '8')
        raw_close_hour = request.query_params.get('close_hour') or os.environ.get('BOOKING_CLOSE_HOUR', '23')

        try:
            open_hour = int(raw_open_hour)
            close_hour = int(raw_close_hour)
        except ValueError:
            return Response(
                {'error': 'Validation Error', 'details': 'open_hour and close_hour must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if open_hour < 0 or close_hour > 24 or open_hour >= close_hour:
            return Response(
                {'error': 'Validation Error', 'details': 'Invalid open/close hour range.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        studio_tz = get_studio_timezone()
        day_start = timezone.make_aware(datetime.combine(target_date, time(hour=open_hour)), studio_tz)
        day_end = timezone.make_aware(datetime.combine(target_date, time(hour=close_hour)), studio_tz)

        # Include every booking that overlaps the target business day in studio timezone.
        bookings = Booking.objects.filter(
            hall=hall,
            start_time__lt=day_end,
            end_time__gt=day_start,
        ).order_by('start_time')

        booked_slots = [
            {
                'booking_id': booking.id,
                'start_time': booking.start_time.isoformat(),
                'end_time': booking.end_time.isoformat(),
            }
            for booking in bookings
        ]

        slots = []

        for hour in range(open_hour, close_hour):
            slot_start = timezone.make_aware(datetime.combine(target_date, time(hour=hour)), studio_tz)
            slot_end = slot_start + timedelta(hours=1)

            is_busy = any(
                booking.start_time < slot_end and booking.end_time > slot_start
                for booking in bookings
            )

            slots.append(
                {
                    'start': slot_start.strftime('%H:%M:%S'),
                    'end': slot_end.strftime('%H:%M:%S'),
                    'available': not is_busy,
                }
            )

        return Response(
            {
                'hall_id': hall.id,
                'hall_name': hall.name,
                'date': date_str,
                'slots': slots,
                'booked_slots': booked_slots,
                'is_fully_free': len(booked_slots) == 0,
            }
        )


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling GET, POST, PATCH, DELETE for /api/bookings/
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['hall', 'start_time']

    def get_queryset(self):
        # Admin can see all, user can see only theirs
        if self.request.user.is_staff:
            return Booking.objects.all()
        return Booking.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Service layer orchestrates atomic creation and overlap check
        booking, order = BookingService.create_booking(
            user=request.user,
            hall=serializer.validated_data['hall'],
            start_time=serializer.validated_data['start_time'],
            end_time=serializer.validated_data['end_time'],
            extra_services_total=serializer.validated_data.get('extra_services_total', 0),
        )
        
        # Trigger background task
        from .tasks import send_booking_confirmation_email
        try:
            send_booking_confirmation_email.delay(booking.id, request.user.email)
        except Exception as exc:
            logger.warning("Celery broker is unavailable, sending booking email synchronously: %s", exc)
            send_booking_confirmation_email(booking.id, request.user.email)
        
        # We can return the serialized booking
        result_serializer = self.get_serializer(booking)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

class AnalyticsSummaryView(views.APIView):
    """
    Endpoint for /api/analytics/summary/
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get a summary of total orders and revenue.",
        responses={
            200: openapi.Response(
                description="Analytics summary",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'total_orders': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_revenue': openapi.Schema(type=openapi.TYPE_NUMBER),
                    }
                )
            )
        }
    )
    def get(self, request):
        if not request.user.is_staff:
            # Maybe standard users get their own summary, admin gets global
            total_bookings = Order.objects.filter(user=request.user).count()
            total_revenue = Order.objects.filter(user=request.user, status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            total_users = 1
            total_halls = Hall.objects.count()
        else:
            total_bookings = Order.objects.count()
            total_revenue = Order.objects.filter(status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            total_users = User.objects.count()
            total_halls = Hall.objects.count()
            
        return Response({
            "total_users": total_users,
            "total_halls": total_halls,
            "total_bookings": total_bookings,
            "total_orders": total_bookings,
            "total_revenue": total_revenue
        })


class OrderListView(generics.ListAPIView):
    """
    GET /api/orders/ — list orders for the current user (admin sees all).
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status']

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.select_related('booking__hall', 'user').all().order_by('-created_at')
        return Order.objects.select_related('booking__hall', 'user').filter(user=self.request.user).order_by('-created_at')


class OrderStatusUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/orders/{id}/status/ — update order status (admin only).
    """
    queryset = Order.objects.select_related('booking__hall', 'user').all()
    serializer_class = OrderStatusUpdateSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_update(self, serializer):
        order = serializer.save()
        broadcast_order_status_update(order)
        from .tasks import send_order_status_changed_email
        try:
            send_order_status_changed_email.delay(order.id, order.user.email, order.status)
        except Exception as exc:
            logger.warning("Celery broker unavailable for status email, sending synchronously: %s", exc)
            send_order_status_changed_email(order.id, order.user.email, order.status)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Frontend expects full order payload with booking details.
        full_payload = OrderSerializer(instance).data
        return Response(full_payload, status=status.HTTP_200_OK)


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
            return Response(
                {"error": e.message},
                status=status.HTTP_400_BAD_REQUEST
            )

        broadcast_order_status_update(order)

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED
        )
