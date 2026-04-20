"""
Security utilities: SSRF protection for user-supplied URLs.
"""
import ipaddress
import socket
from urllib.parse import urlparse
from django.core.exceptions import ValidationError

# RFC 1918 + loopback + link-local + metadata ranges
_BLOCKED_NETWORKS = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),   # AWS/GCP metadata
    ipaddress.ip_network('100.64.0.0/10'),    # Carrier-grade NAT
    ipaddress.ip_network('::1/128'),           # IPv6 loopback
    ipaddress.ip_network('fc00::/7'),          # IPv6 unique local
    ipaddress.ip_network('fe80::/10'),         # IPv6 link-local
]

_ALLOWED_SCHEMES = {'https'}


def validate_no_ssrf(url: str) -> str:
    """
    Validates that a URL:
    - Uses HTTPS only
    - Does not resolve to a private/loopback/metadata IP address

    Raises ValidationError if the URL is unsafe.
    Returns the URL unchanged if safe.
    """
    parsed = urlparse(url)

    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValidationError(
            f'Разрешены только HTTPS URL. Получено: {parsed.scheme}://'
        )

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError('Невалидный URL: отсутствует hostname.')

    # Resolve hostname to IP(s)
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise ValidationError(f'Не удалось разрешить hostname: {hostname}')

    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        for blocked in _BLOCKED_NETWORKS:
            if ip in blocked:
                raise ValidationError(
                    f'URL указывает на приватный/зарезервированный адрес ({ip}). '
                    f'Webhook-запросы к внутренней сети запрещены.'
                )

    return url
