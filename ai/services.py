import os
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta
from django.conf import settings

from studio.models import Booking

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
        
        prev_day = target_date - timedelta(days=1)
        previous_day_orders = Booking.objects.filter(start_time__date=prev_day.date()).count()
        
        features = pd.DataFrame([{
            'day_of_week': day_of_week,
            'month': month,
            'season': season,
            'prev_orders': previous_day_orders
        }])
        
        predicted_value = float(model.predict(features)[0])
        confidence = cls._estimate_confidence(
            model=model,
            features=features,
            predicted_value=predicted_value,
            previous_day_orders=previous_day_orders,
            day_of_week=day_of_week,
        )
        
        weekday_names = [
            "понедельник",
            "вторник",
            "среду",
            "четверг",
            "пятницу",
            "субботу",
            "воскресенье",
        ]

        # Build explanation directly from the selected date so the UI never shows
        # a weekend explanation for a weekday request.
        explanation = f"Выбрана {weekday_names[day_of_week]}, ожидается стандартный спрос для буднего дня."
        if day_of_week >= 5: # Weekend
            explanation = f"Выбрана {weekday_names[day_of_week]}, ожидается повышенный спрос из-за выходного дня."
        elif month in [11, 12]:
            explanation = "Ожидается повышенный спрос из-за праздничного сезона."
            
        return {
            "date": date_str,
            "predicted_orders": int(max(0, round(predicted_value))),
            "confidence": confidence,
            "explanation": explanation
        }

    @staticmethod
    def _estimate_confidence(model, features, predicted_value, previous_day_orders, day_of_week):
        """
        Returns confidence in range [0.50, 0.96].
        Uses model spread (for ensembles) + contextual adjustments.
        """
        confidence = 0.68

        # RandomForest/Bagging-like models: estimate uncertainty via spread across estimators.
        estimators = getattr(model, 'estimators_', None)
        if estimators:
            try:
                raw_predictions = [float(estimator.predict(features)[0]) for estimator in estimators]
                spread = float(np.std(raw_predictions))

                # Lower spread -> higher confidence.
                ensemble_confidence = 1 / (1 + spread)
                confidence = 0.55 + 0.40 * ensemble_confidence
            except Exception:
                confidence = 0.68

        # If model prediction lands exactly near an integer count, confidence is slightly higher.
        distance_to_int = abs(predicted_value - round(predicted_value))
        confidence += max(0.0, 0.06 - distance_to_int * 0.12)

        # Weekend demand pattern is usually more stable for this domain.
        if day_of_week >= 5:
            confidence += 0.03

        # More previous-day data gives slightly more confidence.
        confidence += min(previous_day_orders, 12) * 0.003

        confidence = max(0.50, min(0.96, confidence))
        return round(confidence, 2)
