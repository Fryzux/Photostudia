from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HallViewSet, BookingViewSet, AuditLogViewSet, AnalyticsSummaryView

router = DefaultRouter()
router.register(r'halls', HallViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'audit', AuditLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
]
