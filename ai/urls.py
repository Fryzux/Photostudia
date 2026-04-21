from django.urls import path
from .views import ForecastAPIView, PredictAPIView

urlpatterns = [
    path('predict/', PredictAPIView.as_view(), name='ai-predict'),
    path('forecast/', ForecastAPIView.as_view(), name='ai-forecast'),
]
