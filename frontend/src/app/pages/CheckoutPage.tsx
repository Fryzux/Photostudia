import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, CreditCard, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { createPayment, getOrders, validatePromoCode } from '../services/api';
import type { Order, PromoValidationResult } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Skeleton } from '../components/ui/skeleton';

const paymentOptions = [
  { value: 'card', title: 'Банковская карта', description: 'Моментальное подтверждение бронирования.' },
  { value: 'online', title: 'Онлайн-оплата', description: 'Переход через платёжный шлюз.' },
  { value: 'cash', title: 'Оплата на месте', description: 'Подтвердим заказ, а оплату примем в студии.' },
] as const;

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'online'>('card');
  const [justPaidOrderId, setJustPaidOrderId] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState(() => (searchParams.get('promo') || '').trim().toUpperCase());
  const [promoValidation, setPromoValidation] = useState<PromoValidationResult | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const loadOrders = async () => {
    setLoadError(null);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error: any) {
      const message = error?.message || 'Не удалось загрузить заказ для оплаты.';
      toast.error(message);
      setLoadError(message);
      setOrders([]);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const orderId = searchParams.get('orderId');
  const pendingOrder = useMemo(() => {
    if (!orders) return null;
    if (orderId) {
      return orders.find((order) => String(order.id) === orderId) ?? null;
    }
    return orders.find((order) => order.status === 'PENDING') ?? null;
  }, [orders, orderId]);

  useEffect(() => {
    setPromoValidation(null);
    setPromoError(null);
  }, [pendingOrder?.id]);

  const appliedPromoCode = promoValidation?.promo.code || (pendingOrder?.promo_code ?? null);
  const discountAmount = promoValidation?.discount_amount ?? pendingOrder?.discount_amount ?? 0;
  const payableTotal = promoValidation?.final_total ?? pendingOrder?.final_amount ?? pendingOrder?.total_amount ?? 0;

  const applyPromo = async () => {
    if (!pendingOrder) return null;

    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoValidation(null);
      setPromoError(null);
      return null;
    }

    setValidatingPromo(true);
    setPromoError(null);
    try {
      const result = await validatePromoCode(normalizedCode, pendingOrder.id);
      setPromoValidation(result);
      setPromoCode(normalizedCode);
      toast.success(`Промокод ${result.promo.code} применён.`);
      return result;
    } catch (error: any) {
      const message = error?.message || 'Не удалось применить промокод.';
      setPromoValidation(null);
      setPromoError(message);
      toast.error(message);
      return null;
    } finally {
      setValidatingPromo(false);
    }
  };

  const handlePayment = async () => {
    if (!pendingOrder) return;

    setPaying(true);
    try {
      const normalizedCode = promoCode.trim().toUpperCase();
      let promoCodeToSend: string | undefined;

      if (normalizedCode) {
        const alreadyValidated =
          promoValidation?.order_id === pendingOrder.id && promoValidation?.promo.code === normalizedCode;

        if (alreadyValidated) {
          promoCodeToSend = normalizedCode;
        } else {
          const result = await applyPromo();
          if (!result) {
            return;
          }
          promoCodeToSend = result.promo.code;
        }
      }

      await createPayment({ order_id: pendingOrder.id, method: paymentMethod, promo_code: promoCodeToSend });
      toast.success('Платёж прошёл успешно.');
      setJustPaidOrderId(pendingOrder.id);
      const data = await getOrders();
      setOrders(data);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось провести оплату.');
    } finally {
      setPaying(false);
    }
  };

  if (!orders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card data-reveal="section" className="reveal-section mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="text-[#111111]">Не удалось загрузить заказы</CardTitle>
            <CardDescription className="text-[#5c5c5c]">{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Button className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]" onClick={() => void loadOrders()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pendingOrder) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card data-reveal="section" className="reveal-section mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-[#111111]">
              <CheckCircle2 className="h-5 w-5 text-[#111111]" />
              {justPaidOrderId ? `Заказ #${justPaidOrderId} успешно оплачен` : 'Активных заказов на оплату нет'}
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">
              {justPaidOrderId
                ? 'Оплата подтверждена. Можно перейти в историю бронирований для проверки статуса.'
                : 'Можно вернуться в каталог залов или открыть историю бронирований.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
            <Link to="/halls">
              <Button className="w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">Перейти к залам</Button>
            </Link>
            <Link to="/profile/bookings">
              <Button variant="outline" className="w-full rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]">
                Мои бронирования
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section data-reveal="section" className="reveal-section mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Checkout</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Оформление и оплата бронирования</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">Заказ уже создан на сервере со статусом `PENDING`. Осталось выбрать способ оплаты и подтвердить бронирование.</p>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card data-reveal="section" className="reveal-section mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
              <Receipt className="h-5 w-5 text-[#111111]" />
              Заказ #{pendingOrder.id}
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">Проверьте зал, время и итоговую сумму перед оплатой.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <p className="text-sm text-[#5c5c5c]">Зал</p>
              <p className="mt-1 text-xl font-semibold text-[#111111]">{pendingOrder.booking.hall.name}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="text-sm text-[#5c5c5c]">Начало</p>
                <p className="mt-1 font-medium text-[#111111]">{new Date(pendingOrder.booking.start_time).toLocaleString('ru-RU')}</p>
              </div>
              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="text-sm text-[#5c5c5c]">Окончание</p>
                <p className="mt-1 font-medium text-[#111111]">{new Date(pendingOrder.booking.end_time).toLocaleString('ru-RU')}</p>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-5">
              <p className="text-sm text-[#5c5c5c]">Сумма к оплате</p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-sm text-[#5c5c5c]">
                  <span>Базовая сумма</span>
                  <span>{pendingOrder.total_amount.toLocaleString('ru-RU')} ₽</span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm text-emerald-700">
                    <span>Скидка по промокоду {appliedPromoCode ? `(${appliedPromoCode})` : ''}</span>
                    <span>-{discountAmount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-[#111111]/10 pt-2">
                  <span className="font-medium text-[#111111]">Итог</span>
                  <span className="text-3xl font-semibold text-[#111111]">{payableTotal.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-reveal="section" className="reveal-section mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
              <Wallet className="h-5 w-5 text-[#111111]" />
              Способ оплаты
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">Клиент может завершить заказ сразу после бронирования, без перехода в отдельную админку.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'card' | 'cash' | 'online')}>
              {paymentOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-3 rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4 hover:bg-[#f8f8f5]">
                  <RadioGroupItem value={option.value} id={`payment-${option.value}`} />
                  <Label htmlFor={`payment-${option.value}`} className="cursor-pointer">
                    <div className="font-medium text-[#111111]">{option.title}</div>
                    <div className="text-sm text-[#5c5c5c]">{option.description}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="space-y-2 rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <Label htmlFor="checkout-promo" className="text-xs uppercase tracking-[0.32em] text-[#737373]">
                Промокод
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="checkout-promo"
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value.toUpperCase());
                    setPromoValidation(null);
                    setPromoError(null);
                  }}
                  placeholder="Введите код"
                  maxLength={32}
                  className="h-11 rounded-full border-[#111111]/12 bg-white sm:h-12"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee] sm:h-12"
                  disabled={validatingPromo || !promoCode.trim()}
                  onClick={() => void applyPromo()}
                >
                  {validatingPromo ? 'Проверяем...' : 'Применить'}
                </Button>
              </div>
              {promoError ? <p className="text-sm text-rose-600">{promoError}</p> : null}
              {promoValidation ? (
                <p className="text-sm text-emerald-700">
                  Код {promoValidation.promo.code} применён. Скидка: {promoValidation.discount_amount.toLocaleString('ru-RU')} ₽.
                </p>
              ) : null}
            </div>

            <Button className="h-11 w-full gap-2 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12" disabled={paying} onClick={handlePayment}>
              <CreditCard className="h-4 w-4" />
              {paying ? 'Проводим оплату...' : 'Оплатить заказ'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
