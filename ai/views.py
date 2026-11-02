from datetime import datetime, timedelta
from django.core.cache import cache
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .serializers import AIPredictRequestSerializer
from .services import AIService
from studio import cache as studio_cache


class PredictAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(request_body=AIPredictRequestSerializer)
    def post(self, request, *args, **kwargs):
        serializer = AIPredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Format the date back to string as expected by AIService
        date_str = serializer.validated_data['date'].strftime('%Y-%m-%d')
        
        try:
            # predict() учитывает число броней за предыдущий день → зависит от 'bookings'
            key = studio_cache.make_key('ai:day', date_str, deps=('ai', 'bookings'))
            prediction = studio_cache.get_or_set(key, lambda: AIService.predict(date_str), studio_cache.TTL_AI)
            return Response(prediction, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": "Failed to generate prediction.",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ForecastAPIView(views.APIView):
    """
    POST /api/ai/forecast/

    Принимает hall_id и период (date_from, date_to).
    Возвращает структурированный ForecastResult с тепловой картой.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Почасовой прогноз загрузки зала за период.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['hall_id', 'date_from', 'date_to'],
            properties={
                'hall_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='ID зала'),
                'date_from': openapi.Schema(type=openapi.TYPE_STRING, format='date', description='Начало периода YYYY-MM-DD'),
                'date_to': openapi.Schema(type=openapi.TYPE_STRING, format='date', description='Конец периода YYYY-MM-DD'),
            }
        ),
    )
    def post(self, request, *args, **kwargs):
        # принимаем hall_id (основной) или studio_id (обратная совместимость)
        hall_id = request.data.get('hall_id') or request.data.get('studio_id')
        date_from_str = request.data.get('date_from')
        date_to_str = request.data.get('date_to')

        if not all([hall_id, date_from_str, date_to_str]):
            return Response(
                {'error': 'Поля hall_id, date_from и date_to обязательны.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            hall_id = int(hall_id)
            date_from = datetime.strptime(date_from_str, '%Y-%m-%d')
            date_to = datetime.strptime(date_to_str, '%Y-%m-%d')
        except (ValueError, TypeError):
            return Response(
                {'error': 'Неверный формат. hall_id — целое число, даты — YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if date_to < date_from:
            return Response(
                {'error': 'date_to должна быть не раньше date_from.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_days = 31
        if (date_to - date_from).days > max_days:
            return Response(
                {'error': f'Максимальный период — {max_days} дней.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        key = studio_cache.make_key('ai:forecast', hall_id, date_from_str, date_to_str, deps=('ai',))
        cached = cache.get(key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            # Собираем плоский список ячеек по всем дням — один вызов модели на весь период
            date_strs = [
                (date_from + timedelta(days=i)).strftime('%Y-%m-%d')
                for i in range((date_to - date_from).days + 1)
            ]
            heatmap = [
                {
                    'date': cell['date'],
                    'hour': cell['hour'],
                    'load_percent': round(cell['load_pct']),
                    'confidence': 0.75,
                }
                for cell in AIService.forecast_hourly_range(hall_id, date_strs)
            ]

            # Уникальные дни и часы
            days = sorted({cell['date'] for cell in heatmap})
            hours = sorted({cell['hour'] for cell in heatmap})

            # Summary
            loads = [c['load_percent'] for c in heatmap]
            avg_load = round(sum(loads) / len(loads)) if loads else 0
            peak_cell = max(heatmap, key=lambda c: c['load_percent']) if heatmap else None

            # Рекомендации
            recommendations = []
            if avg_load >= 70:
                recommendations.append('Высокая загрузка в период — рассмотрите повышение цен.')
            elif avg_load >= 40:
                recommendations.append('Умеренная загрузка — хорошее время для акций в слабые часы.')
            else:
                recommendations.append('Низкая загрузка — запустите скидки для привлечения клиентов.')
            if peak_cell:
                recommendations.append(
                    f'Пик ожидается {peak_cell["date"]} в {peak_cell["hour"]:02d}:00 ({peak_cell["load_percent"]}%).'
                )

            result = {
                'hall_id': hall_id,
                'date_from': date_from_str,
                'date_to': date_to_str,
                'days': days,
                'hours': hours,
                'heatmap': heatmap,
                'day_overview': [],
                'summary': {
                    'average_load_percent': avg_load,
                    'average_confidence': 0.75,
                    'peak': peak_cell,
                },
                'recommendations': recommendations,
            }
            cache.set(key, result, studio_cache.TTL_AI)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': 'Не удалось сгенерировать прогноз.', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WeeklyPredictAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get weekly hourly forecast for a hall.",
        manual_parameters=[
            openapi.Parameter('hall_id', openapi.IN_QUERY, description="ID of the hall", type=openapi.TYPE_INTEGER, required=True),
        ]
    )
    def get(self, request, *args, **kwargs):
        hall_id = request.query_params.get('hall_id')
        if not hall_id:
            return Response({"error": "hall_id parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            hall_id = int(hall_id)
            # Прогноз зависит от даты «сегодня», поэтому она входит в ключ
            key = studio_cache.make_key('ai:weekly', hall_id, datetime.now().date().isoformat(), deps=('ai',))
            weekly_forecast = studio_cache.get_or_set(
                key, lambda: AIService.predict_weekly_demand(hall_id), studio_cache.TTL_AI)
            return Response(weekly_forecast, status=status.HTTP_200_OK)
        except ValueError:
            return Response({"error": "hall_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "error": "Failed to generate weekly prediction.",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
