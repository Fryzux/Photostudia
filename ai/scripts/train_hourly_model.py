import os
import sys
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Setup Django
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from studio.models import Booking, Hall
from django.db.models import Count


def generate_hourly_training_data():
    """Генерирует датасет: для каждого часового слота считает вероятность бронирования."""
    print("Fetching booking history from database...")

    bookings = Booking.objects.all().values('hall_id', 'start_time', 'end_time')
    
    # Always include some synthetic data to ensure model sees all hours and variations
    df_synthetic = generate_synthetic_data(n=10000)

    if not bookings:
        print("No bookings found, using synthetic data only...")
        return df_synthetic

    records = []
    for b in bookings:
        start = b['start_time']
        end = b['end_time']
        hall_id = b['hall_id']

        # For each hour in the booking, mark it as booked (1)
        current = start
        while current < end:
            records.append({
                'hall_id': hall_id,
                'day_of_week': current.weekday(),
                'month': current.month,
                'season': (current.month % 12 + 3) // 3,
                'hour': current.hour,
                'booked': 1,
            })
            from datetime import timedelta
            current += timedelta(hours=1)

    df_booked = pd.DataFrame(records)

    # Generate "not booked" records for unoccupied hours across full 24h range
    halls = list(Hall.objects.values_list('id', flat=True))
    from datetime import datetime, timedelta as td
    import random

    not_booked = []
    for _ in range(len(records) * 3):
        hall_id = random.choice(halls)
        days_back = random.randint(1, 365)
        ref_date = datetime.now() - td(days=days_back)
        hour = random.randint(0, 23)

        # Check if this slot was actually booked
        was_booked = df_booked[
            (df_booked['hall_id'] == hall_id) &
            (df_booked['day_of_week'] == ref_date.weekday()) &
            (df_booked['hour'] == hour)
        ].shape[0] > 0

        if not was_booked:
            not_booked.append({
                'hall_id': hall_id,
                'day_of_week': ref_date.weekday(),
                'month': ref_date.month,
                'season': (ref_date.month % 12 + 3) // 3,
                'hour': hour,
                'booked': 0,
            })

    df_not_booked = pd.DataFrame(not_booked)
    df_real = pd.concat([df_booked, df_not_booked], ignore_index=True)
    
    # Combine real and synthetic data
    df = pd.concat([df_real, df_synthetic], ignore_index=True).sample(frac=1, random_state=42)
    print(f"Dataset: {len(df_real)} real samples, {len(df_synthetic)} synthetic samples")
    return df


def generate_synthetic_data(n=10000):
    np.random.seed(42)
    import random
    data = []
    for _ in range(n):
        hour = np.random.randint(0, 24)
        day = np.random.randint(0, 7)
        month = np.random.randint(1, 13)
        hall_id = np.random.randint(1, 10)

        # High-granularity probabilities
        if 11 <= hour <= 19:  # Core peak hours
            prob = 0.5
            if day >= 5: prob += 0.3 # Weekend boost
        elif 9 <= hour <= 21: # Extended working hours
            prob = 0.2
            if day >= 5: prob += 0.2
        elif hour == 8 or hour == 22: # Shoulder hours
            prob = 0.05
        else: # Deep night
            prob = 0.01
            
        if month == 12: prob += 0.1 # Seasonal boost
        
        prob = max(0.01, min(0.95, prob))

        booked = 1 if random.random() < prob else 0
        data.append({
            'hall_id': hall_id,
            'day_of_week': day,
            'month': month,
            'season': (month % 12 + 3) // 3,
            'hour': hour,
            'booked': booked,
        })
    return pd.DataFrame(data)


def train_and_save_hourly_model():
    df = generate_hourly_training_data()

    feature_cols = ['hall_id', 'day_of_week', 'month', 'season', 'hour']
    X = df[feature_cols]
    y = df['booked']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print("\nClassification report:")
    print(classification_report(y_test, preds, target_names=['Not Booked', 'Booked']))

    model_path = BASE_DIR / 'ai' / 'ai_hourly_model.pkl'
    joblib.dump(model, model_path)
    print(f"\nHourly model saved to {model_path}")
    return model


if __name__ == '__main__':
    train_and_save_hourly_model()
