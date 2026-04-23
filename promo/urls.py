from django.urls import path
from .views import PromoCodeListCreateView, PromoCodeValidateView, PromoCodeDeactivateView, PromoCodeActivateView

urlpatterns = [
    path('', PromoCodeListCreateView.as_view(), name='promo-list-create'),
    path('validate/', PromoCodeValidateView.as_view(), name='promo-validate'),
    path('<int:pk>/deactivate/', PromoCodeDeactivateView.as_view(), name='promo-deactivate'),
    path('<int:pk>/activate/', PromoCodeActivateView.as_view(), name='promo-activate'),
]
