import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarClock, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import type { Order } from '../types';
import { getOrders, updateOrderStatus } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePickerInput } from '../components/ui/date-picker-input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function buildDateRange(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo || dateFrom > dateTo) return [];

  const range: string[] = [];
  let cursor = parseISO(dateFrom);
  const to = parseISO(dateTo);

  while (cursor <= to) {
    range.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return range;
}

function isOrderInHour(order: Order, day: string, hour: number) {
  const slotStart = new Date(`${day}T${hour.toString().padStart(2, '0')}:00:00`);
  const slotEnd = new Date(`${day}T${(hour + 1).toString().padStart(2, '0')}:00:00`);
  const bookingStart = new Date(order.booking.start_time);
  const bookingEnd = new Date(order.booking.end_time);
  return bookingStart < slotEnd && bookingEnd > slotStart;
}

function statusTone(status: Order['status']) {
  if (status === 'COMPLETED') return 'border-[#111111] bg-[#111111] text-white';
  if (status === 'CANCELLED') return 'border-[#cfcfc9] bg-[#ececea] text-[#666666]';
  return 'border-[#111111]/18 bg-white text-[#111111]';
}

export function ManagerSchedulePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => toIsoDate(new Date()));
  const [dateTo, setDateTo] = useState(() => toIsoDate(addDays(new Date(), 6)));
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  const hours = useMemo(() => Array.from({ length: 15 }, (_, index) => index + 8), []);
  const days = useMemo(() => buildDateRange(dateFrom, dateTo), [dateFrom, dateTo]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const visibleOrders = useMemo(() => {
    if (!days.length) return [];
    const from = new Date(`${days[0]}T00:00:00`);
    const to = new Date(`${days[days.length - 1]}T23:59:59`);
    return orders.filter((order) => {
      const start = new Date(order.booking.start_time);
      return start >= from && start <= to;
    });
  }, [days, orders]);

  const updateStatus = async (status: Order['status']) => {
    if (!selectedOrder) return;

    setUpdating(true);
    try {
      const updated = await updateOrderStatus(selectedOrder.id, status);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
      setSelectedOrder(updated);
      toast.success(`Статус заказа #${updated.id} обновлён.`);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось обновить статус.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mono-panel rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Менеджер</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Расписание бронирований</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Таймлайн по дням: занятые интервалы выделены, клик по брони открывает боковую панель со статусом и действиями.
        </p>
      </section>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
            <CalendarClock className="h-5 w-5" />
            Период
          </CardTitle>
          <CardDescription className="text-[#5c5c5c]">Выберите диапазон дат для отображения занятых слотов.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px]">
          <div className="space-y-2">
            <Label htmlFor="manager-from" className="text-xs uppercase tracking-[0.32em] text-[#737373]">С</Label>
            <DatePickerInput id="manager-from" value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-to" className="text-xs uppercase tracking-[0.32em] text-[#737373]">По</Label>
            <DatePickerInput id="manager-to" value={dateTo} min={dateFrom} onChange={setDateTo} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="h-12 w-full rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]"
              onClick={() => void loadOrders()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="text-2xl text-[#111111]">Timeline</CardTitle>
          <CardDescription className="text-[#5c5c5c]">
            Нажмите на занятый слот, чтобы открыть карточку заказа и изменить его статус.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {loading ? (
            <p className="text-sm text-[#5c5c5c]">Загружаем расписание...</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-[#5c5c5c]">Некорректный диапазон дат.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[980px] space-y-2">
                <div className="grid gap-2" style={{ gridTemplateColumns: `100px repeat(${days.length}, minmax(130px, 1fr))` }}>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#777777]">Время</div>
                  {days.map((day) => (
                    <div key={day} className="rounded-xl border border-[#111111]/8 bg-white/70 px-3 py-2 text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#777777]">{format(parseISO(day), 'EEE', { locale: ru })}</p>
                      <p className="text-sm font-medium text-[#111111]">{format(parseISO(day), 'dd.MM')}</p>
                    </div>
                  ))}
                </div>

                {hours.map((hour) => (
                  <div key={hour} className="grid gap-2" style={{ gridTemplateColumns: `100px repeat(${days.length}, minmax(130px, 1fr))` }}>
                    <div className="flex items-center justify-center rounded-xl border border-[#111111]/8 bg-white/70 py-2 text-sm text-[#4f4f4f]">
                      {hour.toString().padStart(2, '0')}:00
                    </div>

                    {days.map((day) => {
                      const order = visibleOrders.find((item) => isOrderInHour(item, day, hour)) ?? null;

                      if (!order) {
                        return (
                          <div key={`${day}-${hour}`} className="rounded-xl border border-dashed border-[#111111]/10 bg-[#fbfbf9] px-2 py-2 text-center text-xs text-[#9a9a95]">
                            Свободно
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`${day}-${hour}`}
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className={`rounded-xl border px-2 py-2 text-left text-xs transition hover:opacity-90 ${statusTone(order.status)}`}
                        >
                          <p className="font-semibold">#{order.id} · {order.booking.hall.name}</p>
                          <p>{new Date(order.booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{new Date(order.booking.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="opacity-80">{order.status}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent className="border-l border-[#111111]/10 bg-white sm:max-w-md">
          <SheetHeader className="px-5 pt-6">
            <SheetTitle className="text-2xl text-[#111111]">
              {selectedOrder ? `Заказ #${selectedOrder.id}` : 'Заказ'}
            </SheetTitle>
            <SheetDescription className="text-[#5c5c5c]">
              {selectedOrder ? `${selectedOrder.booking.hall.name} · ${new Date(selectedOrder.booking.start_time).toLocaleString('ru-RU')}` : ''}
            </SheetDescription>
          </SheetHeader>

          {selectedOrder && (
            <div className="space-y-4 px-5 pb-6">
              <div className="rounded-[1.2rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="text-sm text-[#5c5c5c]">Текущий статус</p>
                <p className="mt-1 text-lg font-semibold text-[#111111]">{selectedOrder.status}</p>
              </div>

              <div className="grid gap-2">
                {(['PENDING', 'COMPLETED', 'CANCELLED'] as Array<Order['status']>).map((status) => (
                  <Button
                    key={status}
                    variant={selectedOrder.status === status ? 'default' : 'outline'}
                    className={selectedOrder.status === status ? 'rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]' : 'rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]'}
                    disabled={updating || selectedOrder.status === status}
                    onClick={() => void updateStatus(status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
