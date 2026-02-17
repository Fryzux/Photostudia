from django.urls import path
from . import views

urlpatterns = [
    path("", views.schedule_page, name="schedule"),
    path("auth/", views.auth_page, name="auth"),
    path("my/", views.my_orders_page, name="my_orders"),
    path("admin/journal/", views.admin_journal_page, name="admin_journal"),
    path("ai/", views.ai_page, name="ai"),
]
