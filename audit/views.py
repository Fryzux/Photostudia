from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import generics, permissions

from .models import ActionLog
from .serializers import ActionLogSerializer


class ActionLogListView(generics.ListAPIView):
    serializer_class = ActionLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = ActionLog.objects.select_related('user').order_by('-timestamp')

        search = self.request.query_params.get('search', '').strip()
        action = self.request.query_params.get('action', '').strip()
        date_from = self.request.query_params.get('date_from', '').strip()
        date_to = self.request.query_params.get('date_to', '').strip()

        if search:
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(details__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
            )

        if action and action.lower() != 'all':
            queryset = queryset.filter(action__icontains=action)

        parsed_date_from = parse_date(date_from) if date_from else None
        parsed_date_to = parse_date(date_to) if date_to else None

        if parsed_date_from:
            queryset = queryset.filter(timestamp__date__gte=parsed_date_from)
        if parsed_date_to:
            queryset = queryset.filter(timestamp__date__lte=parsed_date_to)

        return queryset
