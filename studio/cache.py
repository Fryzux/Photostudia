"""
Redis-backed response cache with version-based invalidation.

Every cached value lives under a key that embeds the current version of the
namespaces it depends on, e.g. ``avail:3:2026-11-05:v[bookings:3=7]``.
Invalidation bumps a namespace version (one INCR) instead of hunting for keys:
old entries become unreachable and expire by TTL.

Namespaces:
    halls          - Hall / HallImage changes
    services       - StudioService changes
    bookings:<id>  - bookings of one hall (availability)
    bookings       - any booking (analytics, AI daily prediction)
    orders         - any order (analytics)
    ai             - retrained ML models
"""
import hashlib

from django.core.cache import cache
from django.db import transaction

TTL_CATALOG = 60 * 60      # halls, services
TTL_AVAILABILITY = 5 * 60
TTL_AI = 60 * 60
TTL_ANALYTICS = 2 * 60

_VERSION_PREFIX = 'ver:'


def get_version(namespace):
    key = _VERSION_PREFIX + namespace
    version = cache.get(key)
    if version is None:
        cache.add(key, 1, timeout=None)
        version = cache.get(key) or 1
    return version


def bump(*namespaces):
    """Invalidate namespaces after the current transaction commits."""
    def _bump():
        for namespace in namespaces:
            key = _VERSION_PREFIX + namespace
            try:
                cache.incr(key)
            except ValueError:
                cache.set(key, 2, timeout=None)
    transaction.on_commit(_bump)


def make_key(prefix, *parts, deps=()):
    raw = ':'.join(str(p) for p in parts)
    if len(raw) > 120:
        raw = hashlib.md5(raw.encode()).hexdigest()
    versions = ','.join(f'{ns}={get_version(ns)}' for ns in deps)
    return f'{prefix}:{raw}:v[{versions}]'


def get_or_set(key, producer, timeout):
    value = cache.get(key)
    if value is None:
        value = producer()
        cache.set(key, value, timeout)
    return value


def request_fingerprint(request):
    """Parts of a request that change a public response: host (absolute media URLs) and query."""
    query = '&'.join(f'{k}={v}' for k, v in sorted(request.query_params.items()))
    return f'{request.scheme}://{request.get_host()}', query
