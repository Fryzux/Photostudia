from rest_framework import viewsets, views, generics, permissions
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum
from django.core.exceptions import ValidationError
from .models import Booking, Order, Payment, Hall
from .serializers import BookingSerializer, OrderSerializer, PaymentSerializer, PaymentCreateSerializer, HallSerializer, OrderStatusUpdateSerializer
from .services import BookingService, PaymentService, BookingConflictError


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Anybody can read (GET, HEAD, OPTIONS).
    Only staff/admin users can write (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_staff


from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, NumberFilter
from rest_framework.decorators import action

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
    queryset = Hall.objects.all().order_by('name')
    serializer_class = HallSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = HallFilter
    search_fields = ['name']

    @action(detail=True, methods=['get'], url_path='availability', permission_classes=[permissions.AllowAny])
    def availability(self, request, pk=None):
        """
        GET /api/studio/halls/{id}/availability/?date=YYYY-MM-DD
        Returns a list of booked time slots for the given hall on the given date.
        """
        from datetime import datetime, date as date_type
        from django.utils.timezone import make_aware

        hall = self.get_object()
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

        bookings = Booking.objects.filter(
            hall=hall,
            start_time__date=target_date
        ).order_by('start_time')

        booked_slots = [
            {
                "booking_id": b.id,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
            }
            for b in bookings
        ]

        return Response({
            "hall_id": hall.id,
            "hall_name": hall.name,
            "date": date_str,
            "booked_slots": booked_slots,
            "is_fully_free": len(booked_slots) == 0,
        })


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
        
        promo_code = serializer.validated_data.pop('promo_code', None)
        
        # Service layer orchestrates atomic creation and overlap check
        try:
            booking, order, applied_promo = BookingService.create_booking(
                user=request.user,
                hall=serializer.validated_data['hall'],
                start_time=serializer.validated_data['start_time'],
                end_time=serializer.validated_data['end_time'],
                promo_code=promo_code or None,
            )
        except BookingConflictError as e:
            return Response(
                {"error": "Конфликт бронирования", "details": str(e)},
                status=status.HTTP_409_CONFLICT
            )
        
        # Trigger background task
        from .tasks import send_booking_confirmation_email
        send_booking_confirmation_email.delay(booking.id, request.user.email)
        
        result_serializer = self.get_serializer(booking)
        data = result_serializer.data
        data['order_id'] = order.id
        data['total_amount'] = str(order.total_amount)
        if applied_promo:
            data['promo_applied'] = applied_promo
        return Response(data, status=status.HTTP_201_CREATED)

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

        if not request.user.is_staff:
            total_orders = Order.objects.filter(user=request.user).count()
            total_bookings = Booking.objects.filter(user=request.user).count()
            total_revenue = Order.objects.filter(user=request.user, status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            return Response({
                "total_orders": total_orders,
                "total_bookings": total_bookings,
                "total_revenue": float(total_revenue),
            })
        else:
            total_orders = Order.objects.count()
            total_bookings = Booking.objects.count()
            total_revenue = Order.objects.filter(status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            total_users = User.objects.count()
            total_halls = Hall.objects.count()
            return Response({
                "total_orders": total_orders,
                "total_bookings": total_bookings,
                "total_revenue": float(total_revenue),
                "total_users": total_users,
                "total_halls": total_halls,
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
            return Order.objects.select_related('booking__hall').all().order_by('-created_at')
        return Order.objects.select_related('booking__hall').filter(user=self.request.user).order_by('-created_at')


class OrderStatusUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/orders/{id}/status/ — update order status (admin only).
    """
    queryset = Order.objects.all()
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
                method=serializer.validated_data['method']
            )
        except ValidationError as e:
            return Response(
                {"error": e.message},
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

