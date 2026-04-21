from django.urls import path
from .views import PromoCodeListCreateView, PromoCodeValidateView, PromoCodeDeactivateView

urlpatterns = [
    path('', PromoCodeListCreateView.as_view(), name='promo-list-create'),
    path('validate/', PromoCodeValidateView.as_view(), name='promo-validate'),
    path('<int:pk>/deactivate/', PromoCodeDeactivateView.as_view(), name='promo-deactivate'),
]
