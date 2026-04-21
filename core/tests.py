from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from studio.models import Hall, Booking, Order
from audit.models import ActionLog
from promo.models import PromoCode

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
        self.forecast_url = '/api/forecast/'
        
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

    def test_4_1_booking_creation_with_extra_services_total(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        now = timezone.now()
        data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=1)).isoformat(),
            'end_time': (now + timedelta(days=1, hours=2)).isoformat(),
            'extra_services_total': '500.00',
        }
        res = self.client.post(self.booking_url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(booking_id=res.data['id'])
        self.assertEqual(float(order.total_amount), 3500.0)

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
        from sklearn.ensemble import RandomForestRegressor
        import pandas as pd
        from ai.services import AIService

        model = RandomForestRegressor(n_estimators=10, random_state=42)
        model.fit(
            pd.DataFrame([
                {'day_of_week': 0, 'month': 1, 'season': 1, 'prev_orders': 1},
                {'day_of_week': 2, 'month': 4, 'season': 2, 'prev_orders': 3},
                {'day_of_week': 5, 'month': 4, 'season': 2, 'prev_orders': 8},
                {'day_of_week': 6, 'month': 12, 'season': 4, 'prev_orders': 10},
            ]),
            [4, 6, 11, 15],
        )

        original_model = AIService._model
        AIService._model = model
        
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        try:
            data = {'date': '2026-04-10'}
            res = self.client.post(self.ai_url, data)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertIn('predicted_orders', res.data)
            self.assertIn('explanation', res.data)
        finally:
            AIService._model = original_model

    def test_10_1_ai_forecast_heatmap(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        payload = {
            'hall_id': self.hall.id,
            'date_from': '2026-04-21',
            'date_to': '2026-04-23',
        }
        res = self.client.post(self.forecast_url, payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('heatmap', res.data)
        self.assertIn('recommendations', res.data)
        self.assertIn('summary', res.data)
        self.assertTrue(len(res.data['heatmap']) > 0)

    def test_11_payment_success(self):
        """Create a booking+order and then pay for it successfully."""
        from studio.models import Order
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        now = timezone.now()
        booking_data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=10)).isoformat(),
            'end_time': (now + timedelta(days=10, hours=2)).isoformat(),
        }
        self.client.post(self.booking_url, booking_data)

        order = Order.objects.get(user=self.user)
        res = self.client.post('/api/payments/', {'order_id': order.id, 'method': 'card'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['is_successful'])
        self.assertEqual(res.data['method'], 'card')
        # Order should now be COMPLETED
        order.refresh_from_db()
        self.assertEqual(order.status, 'COMPLETED')

    def test_12_payment_invalid_method(self):
        """Sending an invalid payment method returns 400."""
        from studio.models import Order
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        now = timezone.now()
        booking_data = {
            'hall_id': self.hall.id,
            'start_time': (now + timedelta(days=11)).isoformat(),
            'end_time': (now + timedelta(days=11, hours=1)).isoformat(),
        }
        self.client.post(self.booking_url, booking_data)

        order = Order.objects.get(user=self.user)
        res = self.client.post('/api/payments/', {'order_id': order.id, 'method': 'bitcoin'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_13_payment_wrong_user(self):
        """User cannot pay for another user's order — returns 403."""
        from studio.models import Order
        # Admin creates a booking via direct ORM
        from studio.models import Booking
        now = timezone.now()
        booking = Booking.objects.create(
            user=self.admin, hall=self.hall,
            start_time=now + timedelta(days=12),
            end_time=now + timedelta(days=12, hours=1),
        )
        admin_order = Order.objects.create(user=self.admin, booking=booking, total_amount=1500, status='PENDING')

        # Regular user tries to pay for admin's order
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        res = self.client.post('/api/payments/', {'order_id': admin_order.id, 'method': 'cash'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ─── Hall CRUD Tests ────────────────────────────────────────────

    def test_14_hall_list(self):
        """Any authenticated user can list halls."""
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        res = self.client.get('/api/halls/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # setUp already created one hall
        self.assertGreaterEqual(len(res.data), 1)

    def test_15_admin_create_hall(self):
        """Admin can create a new hall."""
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        data = {'name': 'VIP Hall', 'capacity': 10, 'price_per_hour': '5000.00'}
        res = self.client.post('/api/halls/', data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'VIP Hall')

    def test_16_user_cannot_create_hall(self):
        """Regular user cannot create a hall — returns 403."""
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        data = {'name': 'Sneaky Hall', 'capacity': 5, 'price_per_hour': '100.00'}
        res = self.client.post('/api/halls/', data)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_17_admin_update_hall(self):
        """Admin can update hall price."""
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        data = {'name': self.hall.name, 'capacity': self.hall.capacity, 'price_per_hour': '2000.00'}
        res = self.client.put(f'/api/halls/{self.hall.id}/', data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['price_per_hour'], '2000.00')

    def test_18_admin_delete_hall(self):
        """Admin can delete a hall."""
        from studio.models import Hall as HallModel
        new_hall = HallModel.objects.create(name='Temp Hall', capacity=5, price_per_hour='300.00')
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        res = self.client.delete(f'/api/halls/{new_hall.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(HallModel.objects.filter(id=new_hall.id).exists())

    def test_19_admin_can_view_action_logs(self):
        ActionLog.objects.create(user=self.user, action='Booking Created', details='Booking id: 7')
        ActionLog.objects.create(user=self.admin, action='User Logged In', details='Admin session')

        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        res = self.client.get('/api/audit/logs/?search=Booking')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['action'], 'Booking Created')

    def test_20_user_cannot_view_action_logs(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        res = self.client.get('/api/audit/logs/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_21_admin_can_list_users(self):
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        res = self.client.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['count'], 2)
        usernames = [item['username'] for item in res.data['results']]
        self.assertIn('testuser', usernames)
        self.assertIn('admin', usernames)

    def test_22_user_cannot_list_users(self):
        token = self.get_token('testuser', 'Testpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        res = self.client.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_23_admin_can_deactivate_promo_code(self):
        promo = PromoCode.objects.create(code='SPRING26', discount_percent=20, is_active=True)
        token = self.get_token('admin', 'Adminpassword123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

        res = self.client.patch(f'/api/promos/promocodes/{promo.id}/deactivate/', {})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        promo.refresh_from_db()
        self.assertFalse(promo.is_active)
