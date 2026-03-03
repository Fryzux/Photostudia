from rest_framework import viewsets, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum
from .models import Booking, Order
from .serializers import BookingSerializer
from .services import BookingService

class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling GET, POST, PATCH, DELETE for /api/bookings/
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

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
        
        # We can return the serialized booking
        result_serializer = self.get_serializer(booking)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

class AnalyticsSummaryView(views.APIView):
    """
    Endpoint for /api/analytics/summary/
    """
    permission_classes = [IsAuthenticated]

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
