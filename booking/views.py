from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Count
from django.contrib.auth import get_user_model
from .models import Hall, Booking, AuditLog, Order, Payment
from .serializers import HallSerializer, BookingSerializer, AuditLogSerializer, UserSerializer

User = get_user_model()
from django_filters.rest_framework import DjangoFilterBackend

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff

class HallViewSet(viewsets.ModelViewSet):
    queryset = Hall.objects.all()
    serializer_class = HallSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['capacity', 'price_per_hour']

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Booking.objects.all()
        return Booking.objects.filter(user=user)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAdminUser]

class AnalyticsSummaryView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models.functions import TruncDate

        paid_orders = Order.objects.filter(status='PAID')
        total_revenue = paid_orders.aggregate(total=Sum('total_price'))['total'] or 0

        # Calculate 7-day revenue trend
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_orders = paid_orders.filter(created_at__gte=seven_days_ago)
        daily_revenue = (
            recent_orders
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(revenue=Sum('total_price'))
            .order_by('date')
        )
        
        # Format the trend
        trend_data = [{"date": item['date'].strftime('%Y-%m-%d'), "revenue": float(item['revenue'])} for item in daily_revenue]

        summary = {
            "total_users": User.objects.count(),
            "total_halls": Hall.objects.count(),
            "total_bookings": Booking.objects.count(),
            "paid_orders_count": paid_orders.count(),
            "total_revenue": float(total_revenue),
            "popular_halls": Booking.objects.values('hall__name').annotate(count=Count('id')).order_by('-count')[:3],
            "revenue_trend": trend_data
        }
        return Response(summary)
