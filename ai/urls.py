from django.urls import path
from .views import PredictAPIView, WeeklyPredictAPIView

urlpatterns = [
    path('predict/', PredictAPIView.as_view(), name='ai-predict'),
    path('weekly/', WeeklyPredictAPIView.as_view(), name='ai-predict-weekly'),
]
