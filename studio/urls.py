from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, AnalyticsSummaryView

router = DefaultRouter()
router.register(r'bookings', BookingViewSet, basename='booking')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
]
