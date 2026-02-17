from django.conf import settings
from django.shortcuts import render

def _ctx():
    return {"API_BASE_URL": getattr(settings, "FASTAPI_BASE_URL", "http://127.0.0.1:8001")}

def auth_page(request): return render(request, "studio/auth.html", _ctx())
def schedule_page(request): return render(request, "studio/schedule.html", _ctx())
def my_orders_page(request): return render(request, "studio/my_orders.html", _ctx())
def admin_journal_page(request): return render(request, "studio/admin_journal.html", _ctx())
def ai_page(request): return render(request, "studio/ai.html", _ctx())
