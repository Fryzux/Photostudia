import os
import joblib
from django.conf import settings
from datetime import datetime, timedelta
import pandas as pd
from studio.models import Booking
from django.db.models.functions import TruncDate


class AIService:
    _model = None
    _hourly_model = None

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
    def load_hourly_model(cls):
        if cls._hourly_model is None:
            model_path = os.path.join(settings.BASE_DIR, 'ai', 'ai_hourly_model.pkl')
            if os.path.exists(model_path):
                cls._hourly_model = joblib.load(model_path)
            else:
                raise FileNotFoundError(f"Hourly model not found at {model_path}. Run: python manage.py train_hourly_model")
        return cls._hourly_model

    @classmethod
    def predict(cls, date_str):
        model = cls.load_model()

        target_date = datetime.strptime(date_str, '%Y-%m-%d')
        day_of_week = target_date.weekday()
        month = target_date.month
        season = (month % 12 + 3) // 3

        prev_day = target_date - timedelta(days=1)
        previous_day_orders = Booking.objects.filter(start_time__date=prev_day.date()).count()

        features = pd.DataFrame([{
            'day_of_week': day_of_week,
            'month': month,
            'season': season,
            'prev_orders': previous_day_orders
        }])

        predicted_value = model.predict(features)[0]

        if predicted_value < 5:
            explanation = "Ожидается минимальный спрос. Рекомендуется запустить акцию."
        elif 5 <= predicted_value < 12:
            explanation = "Ожидается обычный (стандартный) спрос залов."
        else:
            explanation = "Ожидается высокая загрузка студии."

        if day_of_week >= 5:
            explanation = "Ожидается повышенный спрос из-за выходного дня"
        elif month in [11, 12]:
            explanation = "Высокий спрос в связи с праздничным сезоном"

        return {
            "date": date_str,
            "predicted_orders": int(max(0, round(predicted_value))),
            "confidence": confidence,
            "explanation": explanation
        }

    @classmethod
    def forecast_hourly(cls, studio_id: int, date_str: str):
        """
        Возвращает почасовой прогноз загрузки для студии на конкретную дату.
        Формат: [{date, hour, load_pct}, ...]  (часы 08:00–22:00)
        """
        try:
            model = cls.load_hourly_model()
            use_ml = True
        except FileNotFoundError:
            use_ml = False

        target_date = datetime.strptime(date_str, '%Y-%m-%d')
        day_of_week = target_date.weekday()
        month = target_date.month
        season = (month % 12 + 3) // 3
        hours = list(range(8, 22))  # 08:00–21:00 (14 слотов)

        if use_ml:
            features = pd.DataFrame([{
                'hall_id': studio_id,
                'day_of_week': day_of_week,
                'month': month,
                'season': season,
                'hour': h,
            } for h in hours])
            probabilities = model.predict_proba(features)[:, 1]
        else:
            # Fallback: эвристика на основе дня недели
            weekend_boost = 0.3 if day_of_week >= 5 else 0.0
            probabilities = [
                min(1.0, 0.2 + weekend_boost + (0.1 if 10 <= h <= 18 else 0.0))
                for h in hours
            ]

        result = []
        for i, hour in enumerate(hours):
            result.append({
                'date': date_str,
                'hour': hour,
                'load_pct': round(float(probabilities[i]) * 100, 1),
            })
        return result

    @classmethod
    def predict_weekly_demand(cls, hall_id: int):
        """
        Возвращает почасовой прогноз загрузки для заданного зала на следующие 7 дней.
        Формат: список дней, каждый содержит список слотов 09:00–21:00 с вероятностью бронирования.
        """
        model = cls.load_hourly_model()

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        result = []

        for day_offset in range(7):
            day = today + timedelta(days=day_offset)
            day_of_week = day.weekday()
            month = day.month
            season = (month % 12 + 3) // 3

            hours = list(range(9, 21))  # 09:00 – 20:00 (12 слотов)
            features = pd.DataFrame([{
                'hall_id': hall_id,
                'day_of_week': day_of_week,
                'month': month,
                'season': season,
                'hour': h,
            } for h in hours])

            probabilities = model.predict_proba(features)[:, 1]  # probability of 'booked'

            slots = []
            for i, hour in enumerate(hours):
                prob = float(probabilities[i])
                slots.append({
                    'hour': hour,
                    'label': f"{hour:02d}:00–{hour + 1:02d}:00",
                    'booking_probability': round(prob, 3),
                    'demand_level': (
                        'high' if prob >= 0.6
                        else 'medium' if prob >= 0.3
                        else 'low'
                    ),
                })

            result.append({
                'date': day.strftime('%Y-%m-%d'),
                'day_label': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][day_of_week],
                'slots': slots,
            })

        return result
