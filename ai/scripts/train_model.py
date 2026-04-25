import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score
import django
from pathlib import Path
import sys

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from studio.models import Booking
from django.db.models.functions import TruncDate
from django.db.models import Count

def get_real_data():
    print("Fetching real data from database...")
    # Group bookings by date and count them
    daily_orders = Booking.objects.annotate(date=TruncDate('start_time')) \
        .values('date') \
        .annotate(count=Count('id')) \
        .order_by('date')
    
    if not daily_orders:
        print("No data found in DB. Falling back to mock.")
        return generate_mock_data()

    data = []
    for entry in daily_orders:
        d = entry['date']
        count = entry['count']
        month = d.month
        data.append({
            'date': d,
            'day_of_week': d.weekday(),
            'month': month,
            'season': (month % 12 + 3) // 3,
            'orders': count
        })
    
    df = pd.DataFrame(data)
    # Add 'prev_orders' feature (shift by 1 day)
    df['prev_orders'] = df['orders'].shift(1).fillna(0)
    
    return df.dropna()

def generate_mock_data(n_samples=1500):
    np.random.seed(42)
    # Features: day_of_week(0-6), month(1-12), season(1-4), prev_orders(int)
    day_of_week = np.random.randint(0, 7, n_samples)
    month = np.random.randint(1, 13, n_samples)
    season = (month % 12 + 3) // 3
    
    # prev_orders is roughly correlated with day_of_week (higher on weekends)
    prev_orders = np.random.poisson(5 + (day_of_week >= 5) * 5, n_samples)
    
    # Target: orders (let's say weekends have generally 10+ orders, weekdays 3-8)
    base_orders = 5
    weekend_boost = (day_of_week >= 5) * 8
    seasonal_boost = (month == 12) * 4 # December boost
    orders = np.random.poisson(base_orders + weekend_boost + seasonal_boost + prev_orders * 0.2, n_samples)
    
    df = pd.DataFrame({
        'day_of_week': day_of_week,
        'month': month,
        'season': season,
        'prev_orders': prev_orders,
        'orders': orders
    })
    return df

def train_and_save_model():
    print("Preparing training dataset...")
    df = get_real_data()
    
    X = df[['day_of_week', 'month', 'season', 'prev_orders']]
    y = df['orders']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, max_depth=4, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    mape = mean_absolute_percentage_error(y_test, preds) * 100
    r2 = r2_score(y_test, preds)

    print(f"Mean Absolute Error (MAE):  {mae:.4f}")
    print(f"MAE Percentage (MAPE):      {mape:.2f}%")
    print(f"R² Score:                   {r2:.4f}")

    if mape <= 15.0 or mae <= 2.0:
        print("✅ Model satisfies MAE requirements.")
    else:
        print("⚠️  WARNING: MAE might be higher than 15%.")

    if r2 >= 0.7:
        print("✅ R² is good (≥ 0.7).")
    else:
        print(f"⚠️  R² is low ({r2:.4f}). Consider more features or data.")
        
    # Save the model
    base_dir = Path(__file__).resolve().parent.parent
    model_path = os.path.join(base_dir, 'ai_model.pkl')
    
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_and_save_model()
