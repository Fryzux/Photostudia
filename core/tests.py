from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from studio.models import Hall, Booking, Order
from audit.models import ActionLog
import os

User = get_user_model()

class PhotostudiaTests(APITestCase):
    def setUp(self):
        # 1. Setup user
        self.user = User.objects.create_user(username='testuser', password='Testpassword123', email='test@test.com', first_name='Test')
        self.admin = User.objects.create_superuser(username='admin', password='Adminpassword123', email='admin@test.com', first_name='Admin')
        
        # Setup Hall
        self.hall = Hall.objects.create(name='Main Hall', capacity=50, price_per_hour=1500.00)

        # URLs
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        self.booking_url = '/api/bookings/'
        self.ai_url = '/api/ai/predict/'
        
    def get_token(self, username, password):
        # Test 2: Authorization
        response = self.client.post(self.login_url, {'username': username, 'password': password})
        return response.data.get('access')

    def test_1_registration(self):
        data = {
            'username': 'newuser',
            'password': 'Strongpassword123',
            'email': 'new@test.com',
            'first_name': 'New'
        }
        res = self.client.post(self.register_url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue('id' in res.data or 'username' in res.data)

    def test_2_authorization(self):
        res = self.client.post(self.login_url, {'username': 'testuser', 'password': 'Testpassword123'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_3_access_without_token(self):
        res = self.client.get(self.booking_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_4_booking_creation(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        now = timezone.now()
        data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=1)).isoformat(),
            'end_time': (now + timedelta(days=1, hours=2)).isoformat()
        }
        res = self.client.post(self.booking_url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)

    def test_5_time_conflict(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        now = timezone.now()
        data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=2)).isoformat(),
            'end_time': (now + timedelta(days=2, hours=2)).isoformat()
        }
        # First booking success
        res1 = self.client.post(self.booking_url, data)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        
        # Second overlapping booking
        data_conflict = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=2, hours=1)).isoformat(),
            'end_time': (now + timedelta(days=2, hours=3)).isoformat()
        }
        res2 = self.client.post(self.booking_url, data_conflict)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res2.data)

    def test_6_booking_deletion(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        now = timezone.now()
        booking = Booking.objects.create(user=self.user, hall=self.hall, start_time=now + timedelta(days=3), end_time=now + timedelta(days=3, hours=1))
        
        res = self.client.delete(f"{self.booking_url}{booking.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Booking.objects.count(), 0)

    def test_7_validation_error(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        now = timezone.now()
        data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=1)).isoformat(),
            'end_time': (now + timedelta(days=1)).isoformat() # Same start and end -> Error
        }
        res = self.client.post(self.booking_url, data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error'], 'Validation Error')

    def test_8_action_log_creation(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        now = timezone.now()
        data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=4)).isoformat(),
            'end_time': (now + timedelta(days=4, hours=2)).isoformat()
        }
        self.client.post(self.booking_url, data)
        
        # Check if logs created for Login and Booking
        logs = ActionLog.objects.filter(user=self.user)
        self.assertTrue(logs.count() >= 1)
        self.assertTrue(logs.filter(action="Booking Created").exists())

    def test_9_role_based_access(self):
        # Admin can view all analytics, user views their own.
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        res = self.client.get('/api/analytics/summary/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_10_ai_prediction(self):
        # Provide mock model file for tests to pass without fully training
        import joblib
        from sklearn.ensemble import RandomForestRegressor
        import pandas as pd
        model = RandomForestRegressor(n_estimators=10, random_state=42)
        model.fit(pd.DataFrame([{'day_of_week':0, 'month':1, 'season': 1, 'prev_orders': 5}]), [10])
        os.makedirs('ai', exist_ok=True)
        joblib.dump(model, 'ai/ai_model.pkl')
        
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        data = {'date': '2026-04-10'}
        res = self.client.post(self.ai_url, data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('predicted_orders', res.data)
        self.assertIn('explanation', res.data)
