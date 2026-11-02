"""
API benchmark: latency and SQL query count for the read-heavy endpoints.

Not part of the regular test suite (file name does not match test*.py).
Runs inside a throwaway test database, so real data is never touched.

Run against the Docker stack (Postgres + Redis exposed on localhost):

    POSTGRES_HOST=localhost CACHE_REDIS_URL=redis://localhost:6379/2 \
    BENCH_OUT=docs/perf/after.json \
    python manage.py test perf.bench_api

Env:
    BENCH_RUNS  - requests per scenario (default 30)
    BENCH_OUT   - path of the JSON report (optional)
"""
import json
import os
import random
import statistics
import time
from datetime import datetime, timedelta, time as dtime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache, caches
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from studio.models import Booking, Hall, HallImage, Order, StudioService

User = get_user_model()

RUNS = int(os.environ.get('BENCH_RUNS', 30))
HALLS = 6
USERS = 200
BOOKINGS_PER_HALL = 500  # ~3000 bookings total


class ApiBenchmark(TestCase):

    @classmethod
    def setUpTestData(cls):
        rnd = random.Random(42)
        tz = timezone.get_current_timezone()

        cls.admin = User.objects.create_superuser('bench_admin', 'a@bench.local', 'BenchPass123!')
        users = User.objects.bulk_create([
            User(username=f'bench_user_{i}', email=f'u{i}@bench.local', password='!')
            for i in range(USERS)
        ])
        cls.user = users[0]

        halls = Hall.objects.bulk_create([
            Hall(name=f'Bench Hall {i}', description='desc ' * 40, capacity=10 + i,
                 price_per_hour=Decimal(1000 + i * 250), image=f'halls/hall_{i}.jpg')
            for i in range(HALLS)
        ])
        HallImage.objects.bulk_create([
            HallImage(hall=h, image=f'halls/gallery/{h.id}_{j}.jpg')
            for h in halls for j in range(3)
        ])
        StudioService.objects.bulk_create([
            StudioService(name=f'Service {i}', description='svc', price=Decimal(500 + i * 100))
            for i in range(8)
        ])

        today = timezone.localdate()
        bookings = []
        for h in halls:
            # one booking per hall per (day, hour) slot, spread over -120..+30 days
            slots = {(d, hr) for d in range(-120, 30) for hr in range(9, 20)}
            for d, hr in rnd.sample(sorted(slots), BOOKINGS_PER_HALL):
                start = datetime.combine(today + timedelta(days=d), dtime(hr, 0), tzinfo=tz)
                bookings.append(Booking(user=rnd.choice(users), hall=h,
                                        start_time=start, end_time=start + timedelta(hours=1)))
        bookings = Booking.objects.bulk_create(bookings)
        Order.objects.bulk_create([
            Order(user=b.user, booking=b, total_amount=b.hall.price_per_hour,
                  status=rnd.choice(['COMPLETED', 'COMPLETED', 'PENDING', 'CANCELLED']))
            for b in bookings
        ])
        cls.hall = halls[0]
        cls.date = (today + timedelta(days=3)).isoformat()

    def setUp(self):
        cache.clear()
        # Models are loaded once per process in production; keep load time out of the numbers
        from ai.services import AIService
        AIService.load_model()
        AIService.load_hourly_model()

        self.anon = APIClient()
        self.user_client = APIClient()
        self.user_client.force_authenticate(self.user)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)
        # Each test client loads the middleware chain on its first request (~400 ms,
        # WhiteNoise scans static files). A running server pays this once at startup.
        for client in (self.anon, self.user_client, self.admin_client):
            client.get('/api/__bench_warmup__/')

    def _measure(self, name, call):
        timings, queries = [], []
        for _ in range(RUNS):
            with CaptureQueriesContext(connection) as ctx:
                start = time.perf_counter()
                response = call()
                timings.append((time.perf_counter() - start) * 1000)
            self.assertLess(response.status_code, 400, f'{name}: {response.status_code} {response.content[:200]}')
            queries.append(len(ctx.captured_queries))
        warm = sorted(timings[1:])
        return {
            'endpoint': name,
            'cold_ms': round(timings[0], 2),
            'median_ms': round(statistics.median(warm), 2),
            'p95_ms': round(warm[int(len(warm) * 0.95) - 1], 2),
            'cold_queries': queries[0],
            'warm_queries': round(statistics.mean(queries[1:]), 1),
        }

    def test_benchmark(self):
        hall_id = self.hall.id
        today = timezone.localdate()
        week_to = (today + timedelta(days=6)).isoformat()
        month_to = (today + timedelta(days=30)).isoformat()
        scenarios = [
            ('GET /api/halls/', lambda: self.anon.get('/api/halls/')),
            ('GET /api/halls/{id}/', lambda: self.anon.get(f'/api/halls/{hall_id}/')),
            ('GET /api/services/', lambda: self.anon.get('/api/services/')),
            ('GET /api/halls/{id}/availability/',
             lambda: self.anon.get(f'/api/halls/{hall_id}/availability/', {'date': self.date})),
            ('GET /api/analytics/summary/ (admin)', lambda: self.admin_client.get('/api/analytics/summary/')),
            ('GET /api/analytics/summary/ (user)', lambda: self.user_client.get('/api/analytics/summary/')),
            ('GET /api/orders/ (admin)', lambda: self.admin_client.get('/api/orders/')),
            ('GET /api/ai/weekly/', lambda: self.user_client.get('/api/ai/weekly/', {'hall_id': hall_id})),
            ('POST /api/ai/forecast/ (7 days)', lambda: self.user_client.post(
                '/api/ai/forecast/', {'hall_id': hall_id, 'date_from': today.isoformat(), 'date_to': week_to},
                format='json')),
            ('POST /api/ai/forecast/ (31 days)', lambda: self.user_client.post(
                '/api/ai/forecast/', {'hall_id': hall_id, 'date_from': today.isoformat(), 'date_to': month_to},
                format='json')),
            ('POST /api/ai/predict/', lambda: self.user_client.post(
                '/api/ai/predict/', {'date': self.date}, format='json')),
        ]
        results = [self._measure(name, call) for name, call in scenarios]

        header = f"{'endpoint':42} {'cold ms':>9} {'median':>9} {'p95':>9} {'SQL cold':>9} {'SQL warm':>9}"
        print('\n' + header + '\n' + '-' * len(header))
        for r in results:
            print(f"{r['endpoint']:42} {r['cold_ms']:9.2f} {r['median_ms']:9.2f} {r['p95_ms']:9.2f} "
                  f"{r['cold_queries']:9} {r['warm_queries']:9}")

        out = os.environ.get('BENCH_OUT')
        if out:
            os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
            with open(out, 'w', encoding='utf-8') as f:
                json.dump({
                    'runs': RUNS,
                    'database': connection.vendor,
                    'cache': type(caches['default']).__name__,
                    'dataset': {'halls': HALLS, 'users': USERS, 'bookings': HALLS * BOOKINGS_PER_HALL},
                    'results': results,
                }, f, ensure_ascii=False, indent=2)
