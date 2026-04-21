from django.urls import path

from .views import ActionLogListView


urlpatterns = [
    path('logs/', ActionLogListView.as_view(), name='action-log-list'),
]
