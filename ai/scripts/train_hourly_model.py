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

from booking.models import Booking, Hall
from django.db.models import Count


def generate_hourly_training_data():
    """Генерирует датасет: для каждого часового слота считает вероятность бронирования."""
    print("Fetching booking history from database...")

    bookings = Booking.objects.all().values('hall_id', 'start_time', 'end_time')

    if not bookings:
        print("No bookings found, generating synthetic data...")
        return generate_synthetic_data()

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

    # Generate "not booked" records for unoccupied hours
    halls = list(Hall.objects.values_list('id', flat=True))
    from datetime import datetime, timedelta as td
    import random

    not_booked = []
    for _ in range(len(records) * 2):  # 2x as many not-booked samples
        hall_id = random.choice(halls)
        days_back = random.randint(1, 730)
        ref_date = datetime.now() - td(days=days_back)
        hour = random.randint(9, 20)

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
    df = pd.concat([df_booked, df_not_booked], ignore_index=True).sample(frac=1, random_state=42)
    print(f"Dataset: {len(df_booked)} booked, {len(df_not_booked)} not-booked samples")
    return df


def generate_synthetic_data(n=3000):
    np.random.seed(42)
    import random
    data = []
    for _ in range(n):
        hour = np.random.randint(9, 21)
        day = np.random.randint(0, 7)
        month = np.random.randint(1, 13)
        hall_id = np.random.randint(1, 4)

        # Probability depends on: weekends higher, midday higher, Dec higher
        prob = 0.3
        if day >= 5:
            prob += 0.25
        if 11 <= hour <= 16:
            prob += 0.2
        if month == 12:
            prob += 0.15
        if 9 <= hour <= 10 or 19 <= hour <= 20:
            prob -= 0.15

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
