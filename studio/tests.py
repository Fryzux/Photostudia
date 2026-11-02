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
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('уже занят', str(response.data))

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
        self.assertTrue(any(h['name'] == 'Cheap Hall' for h in response.data['results']))
        
        # Test filter by price
        response_filter = self.client.get('/api/halls/', {'price_min': '600'})
        self.assertFalse(any(h['name'] == 'Cheap Hall' for h in response_filter.data['results']))


class PromoDoubleDiscountTests(APITestCase):
    """Промокод, применённый при бронировании, не должен списываться повторно при оплате."""

    def setUp(self):
        from datetime import datetime
        from django.utils import timezone
        from promo.models import PromoCode

        self.user = User.objects.create_user(username='promo_user', email='p@test.com', password='StrongPassword123!')
        self.hall = Hall.objects.create(name='Promo Hall', capacity=5, price_per_hour=1000)
        now = timezone.now()
        self.promo = PromoCode.objects.create(
            code='PROMO-TEST', hall=self.hall, discount_percent=30,
            valid_from=now - timedelta(days=1), valid_to=now + timedelta(days=1),
            hour_from=0, hour_to=24,
        )
        day = (now + timedelta(days=2)).date()
        self.start = timezone.make_aware(datetime.combine(day, time(10, 0)))
        self.end = timezone.make_aware(datetime.combine(day, time(12, 0)))

    def test_promo_at_booking_is_stored_on_order(self):
        from decimal import Decimal
        from studio.services import BookingService

        _, order, applied = BookingService.create_booking(
            self.user, self.hall, self.start, self.end, promo_code='PROMO-TEST')
        order.refresh_from_db()

        self.assertEqual(applied, 'PROMO-TEST')
        self.assertEqual(order.total_amount, Decimal('2000.00'))
        self.assertEqual(order.discount_amount, Decimal('600.00'))
        self.assertEqual(order.final_amount, Decimal('1400.00'))
        self.assertEqual(order.applied_promo, self.promo)

    def test_same_promo_at_payment_is_not_applied_twice(self):
        from decimal import Decimal
        from studio.services import BookingService, PaymentService

        _, order, _ = BookingService.create_booking(
            self.user, self.hall, self.start, self.end, promo_code='PROMO-TEST')
        payment = PaymentService.process_payment(order, order.total_amount, 'card', promo_code='PROMO-TEST')
        order.refresh_from_db()

        self.assertEqual(payment.amount, Decimal('1400.00'))
        self.assertEqual(order.final_amount, Decimal('1400.00'))
        self.assertEqual(order.discount_amount, Decimal('600.00'))

    def test_second_promo_at_payment_is_rejected(self):
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        from promo.models import PromoCode
        from studio.services import BookingService, PaymentService

        now = timezone.now()
        PromoCode.objects.create(
            code='PROMO-OTHR', hall=self.hall, discount_percent=50,
            valid_from=now - timedelta(days=1), valid_to=now + timedelta(days=1),
        )
        _, order, _ = BookingService.create_booking(
            self.user, self.hall, self.start, self.end, promo_code='PROMO-TEST')

        with self.assertRaises(ValidationError):
            PaymentService.process_payment(order, order.total_amount, 'card', promo_code='PROMO-OTHR')


from django.test import override_settings


@override_settings(CACHES={'default': {
    'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    'LOCATION': 'studio-cache-tests',
}})
class ResponseCacheTests(APITestCase):
    """Кэш ответов: повторный запрос не ходит в БД, изменения данных сбрасывают кэш."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create_user(username='cache_user', email='c@test.com', password='StrongPassword123!')
        self.other = User.objects.create_user(username='cache_other', email='o@test.com', password='StrongPassword123!')
        self.admin = User.objects.create_superuser(username='cache_admin', email='a@test.com', password='StrongPassword123!')
        self.hall = Hall.objects.create(name='Cache Hall', capacity=5, price_per_hour=1000)
        self.day = date.today() + timedelta(days=3)

    def _book(self, user, start, end):
        from studio.services import BookingService
        with self.captureOnCommitCallbacks(execute=True):
            return BookingService.create_booking(user, self.hall, start, end)

    def _aware(self, day, hour):
        from datetime import datetime
        from django.utils import timezone
        return timezone.make_aware(datetime.combine(day, time(hour, 0)))

    def test_halls_list_second_request_hits_no_db(self):
        self.client.get('/api/halls/')
        with self.assertNumQueries(0):
            response = self.client.get('/api/halls/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('public', response['Cache-Control'])

    def test_hall_change_invalidates_list(self):
        self.client.get('/api/halls/')
        with self.captureOnCommitCallbacks(execute=True):
            Hall.objects.create(name='New Hall', capacity=3, price_per_hour=500)
        names = [h['name'] for h in self.client.get('/api/halls/').data['results']]
        self.assertIn('New Hall', names)

    def test_availability_invalidated_after_booking(self):
        url = f'/api/halls/{self.hall.id}/availability/'
        before = self.client.get(url, {'date': self.day.isoformat()}).data
        self.assertTrue(all(s['available'] for s in before['slots']))

        self._book(self.user, self._aware(self.day, 10), self._aware(self.day, 12))

        after = self.client.get(url, {'date': self.day.isoformat()}).data
        busy = [s['start'] for s in after['slots'] if not s['available']]
        self.assertEqual(busy, ['10:00:00', '11:00:00'])

    def test_availability_includes_booking_from_previous_day(self):
        prev = self.day - timedelta(days=1)
        self._book(self.user, self._aware(prev, 22), self._aware(self.day, 10))

        data = self.client.get(f'/api/halls/{self.hall.id}/availability/', {'date': self.day.isoformat()}).data
        self.assertFalse(data['slots'][0]['available'])  # 09:00 занят ночной бронью
        self.assertFalse(data['is_fully_free'])

    def test_analytics_cached_per_user(self):
        self._book(self.user, self._aware(self.day, 10), self._aware(self.day, 11))

        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/analytics/summary/').data['total_bookings'], 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/analytics/summary/').data['total_bookings'], 0)

    def test_analytics_invalidated_after_booking(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/analytics/summary/').data['total_bookings'], 0)
        self._book(self.user, self._aware(self.day, 10), self._aware(self.day, 11))
        self.assertEqual(self.client.get('/api/analytics/summary/').data['total_bookings'], 1)

    def test_services_cache_separates_staff_and_public(self):
        from studio.models import StudioService
        StudioService.objects.create(name='Active', price=100)
        StudioService.objects.create(name='Hidden', price=100, is_active=False)

        public = [s['name'] for s in self.client.get('/api/services/').data['results']]
        self.client.force_authenticate(self.admin)
        staff_response = self.client.get('/api/services/')
        staff = [s['name'] for s in staff_response.data['results']]

        self.assertEqual(public, ['Active'])
        self.assertEqual(sorted(staff), ['Active', 'Hidden'])
        self.assertIn('private', staff_response['Cache-Control'])

    def test_weekly_forecast_computed_once(self):
        from unittest import mock
        from ai.services import AIService

        self.client.force_authenticate(self.user)
        with mock.patch.object(AIService, 'predict_weekly_demand', return_value=[]) as predict:
            self.client.get('/api/ai/weekly/', {'hall_id': self.hall.id})
            self.client.get('/api/ai/weekly/', {'hall_id': self.hall.id})
        predict.assert_called_once()


from django.db import connection
from django.test.utils import CaptureQueriesContext


class OrderListQueryTests(APITestCase):
    """Список заказов не делает отдельный запрос на каждый заказ (N+1)."""

    def test_order_list_query_count_is_constant(self):
        from datetime import datetime
        from django.utils import timezone
        from studio.models import HallImage

        admin = User.objects.create_superuser(username='nq_admin', email='nq@test.com', password='StrongPassword123!')
        hall = Hall.objects.create(name='NQ Hall', capacity=5, price_per_hour=1000)
        HallImage.objects.create(hall=hall, image='halls/gallery/x.jpg')
        base = timezone.make_aware(datetime.combine(date.today() + timedelta(days=5), time(9, 0)))
        for i in range(10):
            booking = Booking.objects.create(user=admin, hall=hall, start_time=base + timedelta(hours=i),
                                             end_time=base + timedelta(hours=i + 1))
            Order.objects.create(user=admin, booking=booking, total_amount=1000)

        self.client.force_authenticate(admin)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 10)
        self.assertLessEqual(len(ctx.captured_queries), 4)


import threading
from decimal import Decimal
from time import sleep
from unittest import mock
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.utils import timezone
from studio.services import BookingConflictError, BookingService

class BookingRaceTests(TransactionTestCase):
    """Concurrent requests for a free slot must not both succeed. Needs PostgreSQL row locks."""

    @skipUnlessDBFeature('has_select_for_update')
    def test_concurrent_bookings_of_free_slot_create_one(self):
        user = User.objects.create_user(username='racer', password='StrongPassword123!')
        hall = Hall.objects.create(name='Race Hall', capacity=5, price_per_hour=Decimal('1000.00'))
        start = timezone.now().replace(microsecond=0) + timedelta(days=1)
        end = start + timedelta(hours=1)

        barrier = threading.Barrier(2)
        results = []
        real_create = Booking.objects.create

        def slow_create(**kwargs):
            # Keeps the gap between the overlap check and the insert wide open.
            sleep(0.5)
            return real_create(**kwargs)

        def book():
            try:
                barrier.wait(timeout=5)
                BookingService.create_booking(user=user, hall=hall, start_time=start, end_time=end)
                results.append('created')
            except BookingConflictError:
                results.append('conflict')
            finally:
                connection.close()

        with mock.patch.object(Booking.objects, 'create', side_effect=slow_create):
            threads = [threading.Thread(target=book) for _ in range(2)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=15)

        self.assertEqual(Booking.objects.filter(hall=hall).count(), 1)
        self.assertCountEqual(results, ['created', 'conflict'])

    @skipUnlessDBFeature('has_select_for_update')
    def test_concurrent_moves_to_free_slot_move_one(self):
        user = User.objects.create_user(username='racer', password='StrongPassword123!')
        hall = Hall.objects.create(name='Race Hall', capacity=5, price_per_hour=Decimal('1000.00'))
        base = timezone.now().replace(microsecond=0) + timedelta(days=1)
        first = Booking.objects.create(user=user, hall=hall, start_time=base, end_time=base + timedelta(hours=1))
        second = Booking.objects.create(
            user=user, hall=hall, start_time=base + timedelta(hours=2), end_time=base + timedelta(hours=3))
        start, end = base + timedelta(hours=5), base + timedelta(hours=6)

        barrier = threading.Barrier(2)
        results = []
        real_save = Booking.save

        def slow_save(instance, *args, **kwargs):
            sleep(0.5)
            return real_save(instance, *args, **kwargs)

        def move(booking):
            try:
                barrier.wait(timeout=5)
                BookingService.update_booking(booking, hall, start, end)
                results.append('moved')
            except BookingConflictError:
                results.append('conflict')
            finally:
                connection.close()

        with mock.patch.object(Booking, 'save', slow_save):
            threads = [threading.Thread(target=move, args=(booking,)) for booking in (first, second)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=15)

        self.assertEqual(Booking.objects.filter(hall=hall, start_time=start).count(), 1)
        self.assertCountEqual(results, ['moved', 'conflict'])


class BookingUpdateOverlapTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='mover', password='StrongPassword123!', is_staff=True)
        self.hall = Hall.objects.create(name='Hall A', capacity=5, price_per_hour=Decimal('1000.00'))
        self.other_hall = Hall.objects.create(name='Hall B', capacity=5, price_per_hour=Decimal('1000.00'))
        self.base = timezone.now().replace(microsecond=0) + timedelta(days=1)
        self.booking = self._book(self.hall, 0, 1)
        self.client.force_authenticate(user=self.user)

    def _book(self, hall, start_hour, end_hour):
        return Booking.objects.create(
            user=self.user,
            hall=hall,
            start_time=self.base + timedelta(hours=start_hour),
            end_time=self.base + timedelta(hours=end_hour),
        )

    def _patch(self, start_hour, end_hour, **extra):
        return self.client.patch(f'/api/bookings/{self.booking.id}/', {
            'start_time': (self.base + timedelta(hours=start_hour)).isoformat(),
            'end_time': (self.base + timedelta(hours=end_hour)).isoformat(),
            **extra,
        }, format='json')

    def test_move_onto_occupied_slot_is_rejected(self):
        self._book(self.hall, 2, 4)
        response = self._patch(3, 5)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.start_time, self.base)

    def test_move_onto_occupied_slot_of_other_hall_is_rejected(self):
        self._book(self.other_hall, 2, 4)
        response = self._patch(3, 5, hall_id=self.other_hall.id)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.hall_id, self.hall.id)

    def test_changing_only_end_time_onto_occupied_slot_is_rejected(self):
        self._book(self.hall, 2, 4)
        response = self.client.patch(f'/api/bookings/{self.booking.id}/', {
            'end_time': (self.base + timedelta(hours=3)).isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_move_onto_free_slot_succeeds(self):
        response = self._patch(6, 7)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.start_time, self.base + timedelta(hours=6))

    def test_shift_overlapping_own_old_time_succeeds(self):
        response = self._patch(0, 2)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class BookingUpdatePermissionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='customer', password='StrongPassword123!')
        self.hall = Hall.objects.create(name='Hall A', capacity=5, price_per_hour=Decimal('1000.00'))
        self.start = timezone.now().replace(microsecond=0) + timedelta(days=1)
        self.end = self.start + timedelta(hours=1)
        self.booking = Booking.objects.create(
            user=self.user, hall=self.hall, start_time=self.start, end_time=self.end)
        self.url = f'/api/bookings/{self.booking.id}/'
        self.longer = {'end_time': (self.start + timedelta(hours=8)).isoformat()}

    def test_customer_cannot_extend_own_booking_with_patch(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, self.longer, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.end_time, self.end)

    def test_customer_cannot_replace_own_booking_with_put(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.put(self.url, {
            'hall_id': self.hall.id,
            'start_time': self.start.isoformat(),
            **self.longer,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.end_time, self.end)

    def test_manager_cannot_patch_booking(self):
        manager = User.objects.create_user(username='manager', password='StrongPassword123!', is_manager=True)
        self.client.force_authenticate(user=manager)
        response = self.client.patch(self.url, self.longer, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_patch_booking(self):
        admin = User.objects.create_user(username='staff', password='StrongPassword123!', is_staff=True)
        self.client.force_authenticate(user=admin)
        response = self.client.patch(self.url, self.longer, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_customer_can_still_view_and_cancel_own_booking(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_204_NO_CONTENT)
