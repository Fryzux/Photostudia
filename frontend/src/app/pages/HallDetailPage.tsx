import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, ArrowLeft, CalendarRange, Info, PackageCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { AvailabilitySlot, CreateBookingData, Hall, StudioService } from '../types';
import { createBooking, getHall, getHallAvailability, getOrders } from '../services/api';
import { getStudioServices } from '../services/studioServices';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePickerInput } from '../components/ui/date-picker-input';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';

function getTime(value: string) {
  return value.slice(0, 5);
}

function combineDateTime(date: string, time: string) {
  if (!date || !time) return '';
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return '';
  }

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(localDate.getTime())) return '';

  // Отправляем в backend timezone-aware ISO, чтобы избежать сдвига часов.
  return localDate.toISOString();
}

function formatMoney(value: number) {
  return Math.round(value).toLocaleString('ru-RU');
}

export function HallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hall, setHall] = useState<Hall | null>(null);
  const [loading, setLoading] = useState(true);
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityUnsupported, setAvailabilityUnsupported] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [services] = useState<StudioService[]>(() => getStudioServices().filter((item) => item.is_active));

  useEffect(() => {
    if (!id) return;

    const loadHall = async () => {
      try {
        const data = await getHall(Number(id));
        setHall(data);
      } catch (error) {
        toast.error('Не удалось загрузить зал');
        navigate('/halls');
      } finally {
        setLoading(false);
      }
    };

    loadHall();
  }, [id, navigate]);

  const loadAvailability = async (date: string) => {
    if (!id || !date) {
      setAvailabilitySlots([]);
      setSelectedSlotKey('');
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityUnsupported(false);
    try {
      const slots = await getHallAvailability(Number(id), date);
      setAvailabilitySlots(slots);
    } catch (error: any) {
      setAvailabilitySlots([]);
      setAvailabilityUnsupported(true);
      if (!String(error?.message || '').includes('404')) {
        toast.error('Не удалось загрузить слоты доступности.');
      }
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const selectSlot = (slot: AvailabilitySlot) => {
    if (!slot.available || !availabilityDate) return;
    setSelectedSlotKey(`${getTime(slot.start)}-${getTime(slot.end)}`);
  };

  useEffect(() => {
    if (!availabilityDate || !id) return;

    const intervalId = window.setInterval(() => {
      void loadAvailability(availabilityDate);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [availabilityDate, id]);

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!hall) return null;

  const selectedSlotSummary = (() => {
    if (!availabilitySlots.length) return null;
    if (!selectedSlotKey) return null;
    return (
      availabilitySlots.find(
        (slot) => `${getTime(slot.start)}-${getTime(slot.end)}` === selectedSlotKey,
      ) ?? null
    );
  })();

  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const bookingDurationHours = selectedSlotSummary
    ? Math.max(
        0,
        (new Date(`1970-01-01T${selectedSlotSummary.end}`).getTime() -
          new Date(`1970-01-01T${selectedSlotSummary.start}`).getTime()) /
          (60 * 60 * 1000),
      )
    : 0;
  const hallCost = bookingDurationHours * hall.price_per_hour;
  const servicesCost = selectedServices.reduce((sum, service) => {
    if (service.pricing_mode === 'hourly') return sum + service.price * bookingDurationHours;
    return sum + service.price;
  }, 0);
  const estimatedTotal = hallCost + servicesCost;

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((idValue) => idValue !== serviceId) : [...current, serviceId],
    );
  };

  const submitBooking = async () => {
    if (!availabilityDate || !selectedSlotSummary) {
      toast.error('Выберите дату и свободный интервал.');
      return;
    }

    if (!selectedSlotSummary.available) {
      toast.error('Этот интервал уже недоступен. Выберите другой.');
      return;
    }

    const bookingPayload: CreateBookingData = {
      hall_id: hall.id,
      start_time: combineDateTime(availabilityDate, getTime(selectedSlotSummary.start)),
      end_time: combineDateTime(availabilityDate, getTime(selectedSlotSummary.end)),
      extra_services_total: Number(servicesCost.toFixed(2)),
    };
    const normalizedPromoCode = promoCode.trim().toUpperCase();

    setSubmittingBooking(true);
    try {
      const booking = await createBooking(bookingPayload);
      const orders = await getOrders();
      const relatedOrder =
        orders.find((order) => order.booking.id === booking.id) ??
        orders.find((order) => order.status === 'PENDING' || order.status === 'NEW');

      toast.success('Бронь создана. Переходим к оплате.');
      if (relatedOrder) {
        const nextParams = new URLSearchParams({ orderId: String(relatedOrder.id) });
        if (normalizedPromoCode) {
          nextParams.set('promo', normalizedPromoCode);
        }
        navigate(`/checkout?${nextParams.toString()}`);
      } else {
        navigate('/profile/bookings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Не удалось создать бронирование.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex justify-center sm:mb-6">
        <Button variant="ghost" onClick={() => navigate('/halls')} className="h-10 gap-2 rounded-full border border-[#111111]/10 px-5 hover:bg-white sm:h-11">
          <ArrowLeft className="h-4 w-4" />
          Назад к залам
        </Button>
      </div>

      <div className="mb-8 text-center sm:mb-10">
        <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">Карточка зала</p>
        <h1 className="mt-3 text-4xl text-[#111111] sm:text-6xl">{hall.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8">
            <div className="relative h-72 bg-gray-200 sm:h-96">
              {hall.images[0] && <img src={hall.images[0]} alt={hall.name} className="grayscale-photo h-full w-full object-cover" />}
            </div>
            <div className="space-y-5 border-t border-[#111111]/8 p-5 text-center sm:p-8">
              <div className="flex flex-wrap justify-center gap-3">
                <Badge variant="secondary" className="rounded-full bg-white px-4 py-1.5 text-[#111111]">
                  <Users className="mr-1 h-3 w-3" />
                  До {hall.capacity} чел.
                </Badge>
                <Badge variant="secondary" className="rounded-full bg-white px-4 py-1.5 text-[#111111]">
                  {hall.price_per_hour} ₽ / час
                </Badge>
              </div>

              <p className="mx-auto max-w-xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">{hall.description}</p>

              {hall.equipment?.length ? (
                <div className="rounded-[1.25rem] border border-[#111111]/8 bg-white/70 p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[#737373]">Оборудование</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {hall.equipment.map((item) => (
                      <Badge key={`${hall.id}-${item}`} variant="secondary" className="rounded-full bg-white px-3 py-1 text-xs text-[#4f4f4f]">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <Alert className="border-[#111111]/8 bg-white/70 text-left">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Отмечайте свободный слот справа и сразу оформляйте бронь в этой же карточке.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 text-center sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl text-[#111111] sm:text-3xl">
                <CalendarRange className="h-5 w-5" />
                Свободные интервалы
              </CardTitle>
              <CardDescription className="text-base leading-7 text-[#5c5c5c]">
                Выберите дату и отмечайте свободный слот кликом. Занятые интервалы недоступны для выбора.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="space-y-2">
                <Label htmlFor="availability-date" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
                  Проверить дату
                </Label>
                <DatePickerInput
                  id="availability-date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={availabilityDate}
                  onChange={(nextDate) => {
                    setAvailabilityDate(nextDate);
                    setSelectedSlotKey('');
                    void loadAvailability(nextDate);
                  }}
                  className="text-center"
                />
              </div>

              {availabilityLoading && <p className="text-center text-sm text-[#5c5c5c]">Загружаем слоты на выбранную дату...</p>}

              {!availabilityLoading && availabilitySlots.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availabilitySlots.map((slot) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      onClick={() => selectSlot(slot)}
                      disabled={!slot.available}
                      className={`booking-slot rounded-[1.2rem] border px-4 py-3 text-center text-sm ${
                        slot.available ? 'booking-slot--free border-[#111111]/10 text-[#111111]' : 'booking-slot--busy border-[#111111]/8 text-[#555555]'
                      } ${
                        selectedSlotKey === `${getTime(slot.start)}-${getTime(slot.end)}` ? 'booking-slot--selected' : ''
                      }`}
                    >
                      {getTime(slot.start)} - {getTime(slot.end)} · {slot.available ? 'Свободно' : 'Занято'}
                    </button>
                  ))}
                </div>
              )}

              {!availabilityLoading && availabilityUnsupported && (
                <Alert className="border-[#111111]/8 bg-white/70">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Endpoint доступности пока не подключён на сервере. Попробуйте позже или выберите другую дату.
                  </AlertDescription>
                </Alert>
              )}

              {!availabilityLoading && !availabilityUnsupported && availabilityDate && availabilitySlots.length === 0 && (
                <Alert className="border-dashed border-[#111111]/12 bg-white/60">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>На эту дату пока нет отображённых слотов. Попробуйте выбрать другой день.</AlertDescription>
                </Alert>
              )}

              {!availabilityLoading && availabilityDate && !availabilityUnsupported && (
                <p className="text-center text-xs uppercase tracking-[0.24em] text-[#737373]">
                  Календарь обновляется автоматически каждые 15 секунд.
                </p>
              )}

              {selectedSlotSummary && (
                <p className="text-center text-sm text-[#5c5c5c]">
                  Для выбранного стартового времени слот сейчас: {selectedSlotSummary.available ? 'свободен' : 'занят'}.
                </p>
              )}

              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4 sm:p-5">
                {services.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-[#5c5c5c]" />
                      <p className="text-sm uppercase tracking-[0.22em] text-[#737373]">Доп. услуги</p>
                    </div>

                    <div className="grid gap-2">
                      {services.map((service) => {
                        const checked = selectedServiceIds.includes(service.id);
                        return (
                          <label
                            key={service.id}
                            className={`flex cursor-pointer items-start justify-between gap-3 rounded-[1rem] border px-3 py-2.5 transition ${
                              checked ? 'border-[#111111]/24 bg-white' : 'border-[#111111]/10 bg-[#fafaf8] hover:border-[#111111]/18'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium text-[#111111]">{service.name}</p>
                              {service.description ? <p className="text-xs text-[#5c5c5c]">{service.description}</p> : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-xs text-[#4f4f4f]">
                                {service.pricing_mode === 'hourly' ? `${formatMoney(service.price)} ₽/ч` : `${formatMoney(service.price)} ₽`}
                              </p>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleService(service.id)}
                                className="h-4 w-4 rounded border-[#111111]/20 accent-[#111111]"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <Label htmlFor="hall-promo-code" className="text-sm uppercase tracking-[0.22em] text-[#737373]">
                    Промокод
                  </Label>
                  <Input
                    id="hall-promo-code"
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                    placeholder="Введите промокод (если есть)"
                    maxLength={32}
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                  />
                  <p className="text-xs text-[#6a6a6a]">
                    Код проверится и применится на экране оплаты после создания бронирования.
                  </p>
                </div>

                <div className="mt-4 rounded-[1rem] border border-[#111111]/10 bg-[#fbfbf8] p-3 text-sm text-[#4f4f4f]">
                  <div className="mb-1 flex items-center justify-between">
                    <span>Выбранный интервал</span>
                    <span>{selectedSlotSummary ? `${getTime(selectedSlotSummary.start)} - ${getTime(selectedSlotSummary.end)}` : '—'}</span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span>Длительность</span>
                    <span>{bookingDurationHours > 0 ? `${bookingDurationHours.toFixed(1)} ч.` : '—'}</span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span>Зал</span>
                    <span>{formatMoney(hallCost)} ₽</span>
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <span>Доп. услуги</span>
                    <span>{formatMoney(servicesCost)} ₽</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#111111]/10 pt-2 font-semibold text-[#111111]">
                    <span>Итого (оценка на клиенте)</span>
                    <span>{formatMoney(estimatedTotal)} ₽</span>
                  </div>
                </div>

                <Button
                  type="button"
                  className="mt-4 h-11 w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12"
                  disabled={submittingBooking || !availabilityDate || !selectedSlotSummary}
                  onClick={() => void submitBooking()}
                >
                  {submittingBooking ? 'Создаём бронирование...' : 'Создать бронирование'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
