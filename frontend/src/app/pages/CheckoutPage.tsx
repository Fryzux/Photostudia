import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, CreditCard, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { createPayment, getOrders } from '../services/api';
import type { Order } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'online'>('card');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await getOrders();
        setOrders(data);
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить заказ для оплаты.');
        setOrders([]);
      }
    };

    loadOrders();
  }, []);

  const orderId = searchParams.get('orderId');
  const pendingOrder = useMemo(() => {
    if (!orders) return null;
    if (orderId) {
      return orders.find((order) => String(order.id) === orderId) ?? null;
    }
    return orders.find((order) => order.status === 'PENDING') ?? null;
  }, [orders, orderId]);

  const handlePayment = async () => {
    if (!pendingOrder) return;

    setPaying(true);
    try {
      await createPayment({ order_id: pendingOrder.id, method: paymentMethod });
      toast.success('Платёж прошёл успешно.');
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

  if (!pendingOrder) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-[#111111]">
              <CheckCircle2 className="h-5 w-5 text-[#111111]" />
              Активных заказов на оплату нет
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">Можно вернуться в каталог залов или открыть историю бронирований.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:px-6 sm:pb-6">
            <Link to="/halls">
              <Button className="w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">Перейти к залам</Button>
            </Link>
            <Link to="/my-bookings">
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
      <section className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Checkout</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Оформление и оплата бронирования</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">Заказ уже создан на сервере со статусом `PENDING`. Осталось выбрать способ оплаты и подтвердить бронирование.</p>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card className="mono-panel border border-[#111111]/8">
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
              <p className="mt-2 text-3xl font-semibold text-[#111111]">{pendingOrder.total_amount.toLocaleString('ru-RU')} ₽</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mono-panel border border-[#111111]/8">
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
