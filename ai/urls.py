from django.urls import path
from .views import PredictAPIView

urlpatterns = [
    path('predict/', PredictAPIView.as_view(), name='ai-predict'),
]
