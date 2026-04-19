from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .serializers import AIPredictRequestSerializer
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
            weekly_forecast = AIService.predict_weekly_demand(hall_id)
            return Response(weekly_forecast, status=status.HTTP_200_OK)
        except ValueError:
            return Response({"error": "hall_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "error": "Failed to generate weekly prediction.",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
