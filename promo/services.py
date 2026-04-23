from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import PromoCode


def _to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_promo_for_amount(promo: PromoCode, amount: Decimal) -> tuple[Decimal, Decimal]:
    amount = Decimal(str(amount))
    promo_value = Decimal(str(promo.value or 0))

    if promo.promo_type == 'FIXED':
        discount_amount = min(amount, promo_value)
    else:
        percent = promo_value if promo_value > 0 else Decimal(str(promo.discount_percent or 0))
        if percent < 0 or percent > 100:
            raise ValidationError('Некорректное значение скидки.')
        discount_amount = amount * (percent / Decimal('100'))

    discount_amount = _to_money(max(discount_amount, Decimal('0')))
    final_amount = _to_money(max(amount - discount_amount, Decimal('0')))
    return discount_amount, final_amount


def validate_promo(promo: PromoCode) -> None:
    now = timezone.now()

    if not promo.is_active:
        raise ValidationError('Промокод неактивен.')

    if promo.valid_from and now < promo.valid_from:
        raise ValidationError('Промокод ещё не начал действовать.')

    if promo.valid_to and now > promo.valid_to:
        raise ValidationError('Срок действия промокода истёк.')

    if promo.expiry and now > promo.expiry:
        raise ValidationError('Срок действия промокода истёк.')

    if promo.usage_limit is not None and promo.usage_count >= promo.usage_limit:
        raise ValidationError('Лимит использований промокода исчерпан.')

