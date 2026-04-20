from rest_framework import generics, permissions
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import ActionLog
from .serializers import ActionLogSerializer


class AuditLogListView(generics.ListAPIView):
    """
    GET /api/audit/ — список действий аудита (только для admin).

    Фильтры:
      ?search=<текст>        — поиск по action и details
      ?username=<username>   — фильтр по пользователю
      ?date_from=YYYY-MM-DD  — начало диапазона дат
      ?date_to=YYYY-MM-DD    — конец диапазона дат
    """
    serializer_class = ActionLogSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['action', 'details', 'user__username']
    ordering = ['-timestamp']

    def get_queryset(self):
        qs = ActionLog.objects.select_related('user').order_by('-timestamp')

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        username = self.request.query_params.get('username')

        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        if username:
            qs = qs.filter(user__username__icontains=username)

        return qs
