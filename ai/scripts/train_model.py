import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
from pathlib import Path

# Mock generating dataset
def generate_mock_data(n_samples=1000):
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
    print("Generating training dataset...")
    df = generate_mock_data()
    
    X = df[['day_of_week', 'month', 'season', 'prev_orders']]
    y = df['orders']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    mape = mean_absolute_percentage_error(y_test, preds)
    
    mae_percentage = mape * 100
    
    print(f"Mean Absolute Error (raw): {mae:.2f}")
    print(f"MAE Percentage (MAPE): {mae_percentage:.2f}%")
    
    if mae_percentage <= 15.0 or mae <= 2.0:
        print("Model satisfies MAE requirements.")
    else:
        print("WARNING: MAE might be higher than 15% depending on measurement scale.")
        
    # Save the model
    base_dir = Path(__file__).resolve().parent.parent
    model_path = os.path.join(base_dir, 'ai_model.pkl')
    
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_and_save_model()
