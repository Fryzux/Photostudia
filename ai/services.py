import os
import joblib
from django.conf import settings
from datetime import datetime, timedelta
import pandas as pd
from booking.models import Booking
from django.db.models.functions import TruncDate

class AIService:
    _model = None

    @classmethod
    def load_model(cls):
        if cls._model is None:
            model_path = os.path.join(settings.BASE_DIR, 'ai', 'ai_model.pkl')
            if os.path.exists(model_path):
                cls._model = joblib.load(model_path)
            else:
                raise FileNotFoundError(f"Model not found at {model_path}")
        return cls._model

    @classmethod
    def predict(cls, date_str):
        """
        Predicts orders for a given date string 'YYYY-MM-DD'.
        """
        model = cls.load_model()
        
        target_date = datetime.strptime(date_str, '%Y-%m-%d')
        # Extract features (should match training features)
        day_of_week = target_date.weekday()
        month = target_date.month
        # Mock season (1: Winter, 2: Spring, 3: Summer, 4: Autumn)
        season = (month % 12 + 3) // 3
        
        # Fetch real previous day orders from DB
        prev_day = target_date - timedelta(days=1)
        previous_day_orders = Booking.objects.filter(start_time__date=prev_day.date()).count()
        
        features = pd.DataFrame([{
            'day_of_week': day_of_week,
            'month': month,
            'season': season,
            'prev_orders': previous_day_orders
        }])
        
        predicted_value = model.predict(features)[0]
        
        # Determine explanation based on input features or prediction rules
        explanation = "Standard demand expected."
        if day_of_week >= 5: # Weekend
            explanation = "Ожидается повышенный спрос из-за выходного дня"
        elif month in [11, 12]:
            explanation = "Высокий спрос в связи с праздничным сезоном"
            
        return {
            "predicted_orders": int(max(0, round(predicted_value))),
            "explanation": explanation
        }
