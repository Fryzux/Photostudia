from rest_framework import viewsets, views, generics, permissions
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum
from django.core.exceptions import ValidationError
from .models import Booking, Order, Payment, Hall
from .serializers import BookingSerializer, OrderSerializer, PaymentSerializer, PaymentCreateSerializer, HallSerializer, OrderStatusUpdateSerializer
from .services import BookingService, PaymentService


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Authenticated users can read (GET, HEAD, OPTIONS).
    Only staff/admin users can write (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff


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
            end_time=serializer.validated_data['end_time']
        )
        
        # Trigger background task
        from .tasks import send_booking_confirmation_email
        send_booking_confirmation_email.delay(booking.id, request.user.email)
        
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
            total_orders = Order.objects.filter(user=request.user).count()
            total_revenue = Order.objects.filter(user=request.user, status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        else:
            total_orders = Order.objects.count()
            total_revenue = Order.objects.filter(status='COMPLETED').aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            
        return Response({
            "total_orders": total_orders,
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
            return Order.objects.select_related('booking__hall').all().order_by('-created_at')
        return Order.objects.select_related('booking__hall').filter(user=self.request.user).order_by('-created_at')


class OrderStatusUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/orders/{id}/status/ — update order status (admin only).
    """
    queryset = Order.objects.all()
    serializer_class = OrderStatusUpdateSerializer
    permission_classes = [permissions.IsAdminUser]


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

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED
        )

