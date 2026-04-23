from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, AnalyticsSummaryView, OrderListView, PaymentCreateView, HallViewSet, OrderStatusUpdateView, StudioServiceViewSet

router = DefaultRouter()
router.register(r'halls', HallViewSet, basename='hall')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'services', StudioServiceViewSet, basename='service')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('orders/', OrderListView.as_view(), name='order-list'),
    path('orders/<int:pk>/status/', OrderStatusUpdateView.as_view(), name='order-status-update'),
    path('payments/', PaymentCreateView.as_view(), name='payment-create'),
]
