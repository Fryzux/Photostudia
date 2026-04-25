import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, CheckCircle, Clock, CreditCard, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Order } from '../types';
import { cancelBooking, createPayment, getOrders } from '../services/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DatePickerInput } from '../components/ui/date-picker-input';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';

const BOOKING_CACHE_KEY = 'exposition-bookings-cache-v1';
const CACHE_TTL_MS = 60_000;
const PAGE_SIZE = 6;

export function MyBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; orderId: number | null }>({
    open: false,
    orderId: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; bookingId: number | null }>({
    open: false,
    bookingId: null,
  });
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'online'>('card');
  const [paying, setPaying] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  useEffect(() => {
    const loadBookings = async () => {
      const cachedRaw = sessionStorage.getItem(BOOKING_CACHE_KEY);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { timestamp: number; orders: Order[] };
          if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
            setOrders(cached.orders);
            setLoading(false);
          }
        } catch {
          sessionStorage.removeItem(BOOKING_CACHE_KEY);
        }
      }

      try {
        const data = await getOrders();
        setOrders(data);
        sessionStorage.setItem(
          BOOKING_CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            orders: data,
          }),
        );
      } catch (error) {
        toast.error('Не удалось загрузить ваши заказы');
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, []);

  const reloadOrders = async () => {
    const data = await getOrders();
    setOrders(data);
    sessionStorage.setItem(
      BOOKING_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        orders: data,
      }),
    );
  };

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    setSearchParams(next, { replace: true });
  };

  const handleCancel = async () => {
    if (!deleteDialog.bookingId) return;
    if (cancellingBookingId === deleteDialog.bookingId) return;

    setCancellingBookingId(deleteDialog.bookingId);
    try {
      await cancelBooking(deleteDialog.bookingId);
      toast.success('Бронирование отменено');
      setDeleteDialog({ open: false, bookingId: null });
      await reloadOrders();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось отменить бронирование');
    } finally {
      setCancellingBookingId(null);
    }
  };

  const handlePayment = async () => {
    if (!paymentDialog.orderId) return;

    setPaying(true);
    try {
      await createPayment({
        order_id: paymentDialog.orderId,
        method: paymentMethod,
      });
      toast.success('Оплата прошла успешно!');
      setPaymentDialog({ open: false, orderId: null });
      await reloadOrders();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка оплаты. Попробуйте снова.');
    } finally {
      setPaying(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.booking.hall.name.toLowerCase().includes(search.toLowerCase()) ||
      String(order.id).includes(search);
    const matchesStatus = status === 'all' || order.status === status;
    const bookingDate = format(new Date(order.booking.start_time), 'yyyy-MM-dd');
    const matchesDateFrom = !dateFrom || bookingDate >= dateFrom;
    const matchesDateTo = !dateTo || bookingDate <= dateTo;

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page <= totalPages) return;
    updateParam('page', String(totalPages));
  }, [page, totalPages, updateParam]);

  const cancellableStatuses = new Set<string>(['PENDING', 'CONFIRMED']);

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section data-reveal="section" className="reveal-section mono-panel rounded-[2rem] border border-border px-5 py-8 text-center sm:px-8 sm:py-10">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-muted-foreground">Мои брони</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Управление бронированиями</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
          Отслеживайте статусы, оплачивайте созданные заказы и быстро находите нужную бронь по названию зала или номеру.
        </p>
      </section>

      <Card data-reveal="section" className="reveal-section mono-panel border border-border">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="text-2xl text-foreground">Поиск и фильтрация</CardTitle>
          <CardDescription className="text-muted-foreground">Можно быстро найти заказ по номеру, названию зала или статусу.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px_160px]">
          <div className="space-y-2">
            <Label htmlFor="booking-search" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="booking-search"
                className="h-11 rounded-full border-border bg-card pl-9 text-sm sm:h-12 sm:text-base"
                placeholder="Номер заказа или название зала"
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-status" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Статус</Label>
            <Select value={status} onValueChange={(value) => updateParam('status', value)}>
              <SelectTrigger id="booking-status" className="h-11 rounded-full border-border bg-card text-sm sm:h-12 sm:text-base">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="NEW">Новый</SelectItem>
                <SelectItem value="PENDING">Ожидает оплаты</SelectItem>
                <SelectItem value="CONFIRMED">Подтверждено</SelectItem>
                <SelectItem value="COMPLETED">Оплачено</SelectItem>
                <SelectItem value="CANCELLED">Отменено</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-date-from" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Дата от</Label>
            <DatePickerInput id="booking-date-from" value={dateFrom} onChange={(value) => updateParam('date_from', value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-date-to" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Дата до</Label>
            <DatePickerInput id="booking-date-to" value={dateTo} onChange={(value) => updateParam('date_to', value)} />
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="h-11 w-full rounded-full border-border bg-card text-foreground hover:bg-accent sm:h-12" onClick={() => setSearchParams({}, { replace: true })}>
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredOrders.length > 0 && (
        <div data-reveal="section" className="reveal-section grid gap-4">
          {filteredOrders.map((order, index) => {
            const { booking } = order;
            const duration = calculateDuration(booking.start_time, booking.end_time);
            const isCancellingCurrent = cancellingBookingId === booking.id;
            const canCancel = cancellableStatuses.has(order.status);

            return (
              <Card key={order.id} className="reveal-card mono-panel border border-border" style={{ transitionDelay: `${100 + index * 55}ms` }}>
                <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-2xl text-foreground">{booking.hall.name}</CardTitle>
                      <CardDescription className="mt-1 text-muted-foreground">Заказ #{order.id}</CardDescription>
                    </div>
                    {order.status === 'COMPLETED' ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#111111] px-3 py-1 text-sm font-medium text-white">
                        <CheckCircle className="h-3 w-3" />
                        Оплачено
                      </span>
                    ) : order.status === 'CANCELLED' ? (
                      <span className="inline-flex w-fit items-center rounded-full bg-card px-3 py-1 text-sm font-medium text-muted-foreground">Отменено</span>
                    ) : (
                      <span className="inline-flex w-fit items-center rounded-full bg-card px-3 py-1 text-sm font-medium text-foreground">Ожидает оплаты</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Дата начала</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(booking.start_time), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Дата окончания</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(booking.end_time), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Длительность:</span>
                        <span className="font-medium text-foreground">{duration.toFixed(1)} ч.</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Сумма к оплате:</span>
                        <span className="text-lg font-bold text-foreground">{order.total_amount.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {order.status === 'PENDING' && (
                        <Button className="h-11 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90 sm:h-12 sm:flex-1" onClick={() => setPaymentDialog({ open: true, orderId: order.id })}>
                          <CreditCard className="h-4 w-4" />
                          Оплатить
                        </Button>
                      )}

                      {canCancel ? (
                        <Button
                          variant="outline"
                          className="h-11 w-full gap-2 rounded-full border-border bg-card text-foreground hover:bg-accent sm:h-12 sm:w-auto"
                          disabled={isCancellingCurrent}
                          onClick={() => setDeleteDialog({ open: true, bookingId: booking.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isCancellingCurrent ? 'Обрабатываем...' : 'Отменить'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredOrders.length === 0 && (
        <div data-reveal="section" className="reveal-section mono-panel rounded-[2rem] border border-dashed border-border px-5 py-12 text-center sm:px-6">
          <Calendar className="mx-auto mb-4 h-14 w-14 text-[#c2c2bc]" />
          <h3 className="mb-2 text-xl text-foreground">Подходящих бронирований не найдено</h3>
          <p className="mb-6 text-muted-foreground">Попробуйте изменить фильтры или создайте новое бронирование.</p>
          <Link to="/halls">
            <Button className="rounded-full bg-[#111111] px-6 text-white hover:bg-foreground/90">Посмотреть залы</Button>
          </Link>
        </div>
      )}

      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => setPaymentDialog((current) => ({ open, orderId: open ? current.orderId : null }))}
      >
        <DialogContent className="border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Оплата бронирования</DialogTitle>
            <DialogDescription className="text-muted-foreground">Выберите способ оплаты для завершения бронирования.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="mb-3 block text-xs uppercase tracking-[0.32em] text-muted-foreground">Способ оплаты</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'card' | 'cash' | 'online')}>
              <div className="flex cursor-pointer items-center space-x-2 rounded-[1.2rem] border border-border p-3 hover:bg-[#f8f8f5]">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex-1 cursor-pointer">
                  <div className="font-medium">Банковская карта</div>
                  <div className="text-sm text-muted-foreground">Visa, MasterCard, МИР</div>
                </Label>
              </div>
              <div className="flex cursor-pointer items-center space-x-2 rounded-[1.2rem] border border-border p-3 hover:bg-[#f8f8f5]">
                <RadioGroupItem value="online" id="online" />
                <Label htmlFor="online" className="flex-1 cursor-pointer">
                  <div className="font-medium">Онлайн-оплата</div>
                  <div className="text-sm text-muted-foreground">Через платёжную систему</div>
                </Label>
              </div>
              <div className="flex cursor-pointer items-center space-x-2 rounded-[1.2rem] border border-border p-3 hover:bg-[#f8f8f5]">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex-1 cursor-pointer">
                  <div className="font-medium">Наличными</div>
                  <div className="text-sm text-muted-foreground">Оплата на месте</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full border-border bg-card text-foreground hover:bg-accent" onClick={() => setPaymentDialog({ open: false, orderId: null })}>
              Отмена
            </Button>
            <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={handlePayment} disabled={paying}>
              {paying ? 'Обработка...' : 'Оплатить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((current) => ({ open, bookingId: open ? current.bookingId : null }))}>
        <AlertDialogContent className="border border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Подтвердите действие</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Бронирование будет отменено, а действие попадет в журнал аудита на сервере.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancellingBookingId !== null}>
              {cancellingBookingId !== null ? 'Отменяем...' : 'Подтвердить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
