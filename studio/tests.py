from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from studio.models import Hall, Booking, Order
from datetime import date, timedelta, time

User = get_user_model()

class PhotostudiaAPITests(APITestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_superuser(username='admin', email='admin@test.com', password='StrongPassword123!')
        self.user = User.objects.create_user(username='customer', email='user@test.com', password='StrongPassword123!')
        
        # Create a hall
        self.hall = Hall.objects.create(
            name='Test Hall',
            capacity=10,
            price_per_hour=1000.00
        )

    # Scenarios 1 & 2: Registration
    def test_registration_success(self):
        """1. Positive registration test"""
        data = {'username': 'newuser', 'email': 'new@test.com', 'password': 'StrongPassword123!', 'first_name': 'New'}
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_registration_duplicate_username(self):
        """2. Negative registration test (duplicate email)"""
        data = {'username': 'customer', 'email': 'new2@test.com', 'password': 'StrongPassword123!', 'first_name': 'User'}
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Scenarios 3 & 4: Authentication
    def test_login_success(self):
        """3. Positive login test"""
        data = {'username': 'customer', 'password': 'StrongPassword123!'}
        response = self.client.post('/api/auth/login/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_login_invalid_credentials(self):
        """4. Negative login test (wrong password)"""
        data = {'username': 'customer', 'password': 'wrongpassword'}
        response = self.client.post('/api/auth/login/', data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Scenarios 5 & 6: Roles and Permissions (Halls)
    def test_create_hall_as_admin(self):
        """5. Admin can create halls"""
        self.client.force_authenticate(user=self.admin)
        data = {'name': 'Admin Hall', 'capacity': 20, 'price_per_hour': 2500.00}
        response = self.client.post('/api/halls/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_hall_as_user(self):
        """6. Regular user cannot create halls"""
        self.client.force_authenticate(user=self.user)
        data = {'name': 'User Hall', 'capacity': 20, 'price_per_hour': 2500.00}
        response = self.client.post('/api/halls/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # Scenarios 7, 8 & 9: Business Logic (Bookings)
    def test_create_booking_success(self):
        """7. Create a valid booking"""
        self.client.force_authenticate(user=self.user)
        future_date = date.today() + timedelta(days=1)
        data = {
            'hall_id': self.hall.id,
            'start_time': f"{future_date}T10:00:00Z",
            'end_time': f"{future_date}T12:00:00Z"
        }
        response = self.client.post('/api/bookings/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)

    def test_create_booking_overlap(self):
        """8. Prevent double booking (overlapping time)"""
        from django.utils import timezone
        import datetime
        future_date = datetime.date.today() + datetime.timedelta(days=2)
        start_dt = timezone.make_aware(datetime.datetime.combine(future_date, datetime.time(10, 0)))
        end_dt = timezone.make_aware(datetime.datetime.combine(future_date, datetime.time(14, 0)))
        
        # Create existing booking
        Booking.objects.create(
            user=self.user,
            hall=self.hall,
            start_time=start_dt,
            end_time=end_dt
        )
        
        self.client.force_authenticate(user=self.user)
        data = {
            'hall_id': self.hall.id,
            'start_time': f"{future_date}T12:00:00Z", # Overlaps with 10:00-14:00
            'end_time': f"{future_date}T15:00:00Z"
        }
        response = self.client.post('/api/bookings/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('This hall is already booked for the selected time slot.', str(response.data))

    def test_create_booking_invalid_time(self):
        """9. Prevent booking where end_time is before start_time"""
        self.client.force_authenticate(user=self.user)
        future_date = date.today() + timedelta(days=3)
        data = {
            'hall_id': self.hall.id,
            'start_time': f"{future_date}T15:00:00Z",
            'end_time': f"{future_date}T12:00:00Z"
        }
        response = self.client.post('/api/bookings/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Scenario 10: Searching/Filtering
    def test_search_and_filter_halls(self):
        """10. Test filtering and searching halls"""
        self.client.force_authenticate(user=self.user)
        Hall.objects.create(name='Cheap Hall', capacity=5, price_per_hour=500.00)
        
        # Test search
        response = self.client.get('/api/halls/', {'search': 'Cheap'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Cheap Hall')
        
        # Test filter by price
        response_filter = self.client.get('/api/halls/', {'price_min': '600'})
        self.assertEqual(len(response_filter.data['results']), 1)
        self.assertEqual(response_filter.data['results'][0]['name'], 'Test Hall') # Which is 1000.00
