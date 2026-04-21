from datetime import timedelta

from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema

from studio.models import Hall

from .serializers import AIForecastRequestSerializer, AIPredictRequestSerializer
from .services import AIService


class PredictAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(request_body=AIPredictRequestSerializer)
    def post(self, request, *args, **kwargs):
        serializer = AIPredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Format the date back to string as expected by AIService
        date_str = serializer.validated_data['date'].strftime('%Y-%m-%d')
        
        try:
            prediction = AIService.predict(date_str)
            return Response(prediction, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": "Failed to generate prediction.",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ForecastAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(request_body=AIForecastRequestSerializer)
    def post(self, request, *args, **kwargs):
        serializer = AIForecastRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hall_id = serializer.validated_data.get('hall_id')
        date_from = serializer.validated_data['date_from']
        date_to = serializer.validated_data['date_to']

        hall = None
        if hall_id:
            hall = Hall.objects.filter(id=hall_id).first()
            if not hall:
                return Response(
                    {'error': 'Validation Error', 'details': 'Hall with provided hall_id was not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        days = []
        current_day = date_from
        while current_day <= date_to:
            days.append(current_day)
            current_day += timedelta(days=1)

        hours = list(range(8, 23))
        heatmap = []
        day_overview = []

        for day in days:
            day_str = day.strftime('%Y-%m-%d')
            prediction = AIService.predict(day_str)
            predicted_orders = int(prediction.get('predicted_orders', 0))
            day_confidence = float(prediction.get('confidence', 0.7))
            day_of_week = day.weekday()

            base_load = min(92, max(12, predicted_orders * 9))
            day_values = []

            for hour in hours:
                peak_hour = 18 if day_of_week >= 5 else 16
                distance = abs(hour - peak_hour)
                hour_factor = max(0.28, 1 - distance * 0.13)
                weekend_bonus = 8 if day_of_week >= 5 else 0
                hall_modifier = 0

                if hall:
                    hall_modifier += min(8, int(hall.capacity / 12))
                    if float(hall.price_per_hour) > 5000:
                        hall_modifier += 4

                load_percent = int(round(base_load * hour_factor + weekend_bonus + hall_modifier))
                load_percent = max(3, min(98, load_percent))
                day_values.append(load_percent)

                heatmap.append(
                    {
                        'date': day_str,
                        'hour': hour,
                        'load_percent': load_percent,
                        'predicted_orders': predicted_orders,
                        'confidence': day_confidence,
                    }
                )

            day_overview.append(
                {
                    'date': day_str,
                    'avg_load_percent': int(round(sum(day_values) / len(day_values))),
                    'predicted_orders': predicted_orders,
                    'confidence': day_confidence,
                    'explanation': prediction.get('explanation', ''),
                }
            )

        peak_cell = max(heatmap, key=lambda item: item['load_percent']) if heatmap else None
        average_load = int(round(sum(item['load_percent'] for item in heatmap) / len(heatmap))) if heatmap else 0
        average_confidence = round(sum(item['confidence'] for item in heatmap) / len(heatmap), 2) if heatmap else 0.0

        recommendations = []
        if average_load >= 70:
            recommendations.append('Ожидается высокий средний спрос. Рекомендуется усилить команду на пиковые часы.')
        elif average_load >= 45:
            recommendations.append('Нагрузка умеренная. Поддерживайте гибкое расписание и следите за вечерними слотами.')
        else:
            recommendations.append('Низкая нагрузка. Период подходит для акций и тестовых съемок.')

        if peak_cell:
            recommendations.append(
                f"Пиковое окно: {peak_cell['date']} в {peak_cell['hour']:02d}:00 (до {peak_cell['load_percent']}% загрузки)."
            )

        if hall:
            recommendations.append(f"Выбрана студия «{hall.name}». Учитывайте её вместимость ({hall.capacity} чел.) в расписании.")

        return Response(
            {
                'hall_id': hall.id if hall else None,
                'date_from': date_from.strftime('%Y-%m-%d'),
                'date_to': date_to.strftime('%Y-%m-%d'),
                'hours': hours,
                'days': [day.strftime('%Y-%m-%d') for day in days],
                'heatmap': heatmap,
                'day_overview': day_overview,
                'summary': {
                    'average_load_percent': average_load,
                    'average_confidence': average_confidence,
                    'peak': peak_cell,
                },
                'recommendations': recommendations,
            },
            status=status.HTTP_200_OK,
        )
