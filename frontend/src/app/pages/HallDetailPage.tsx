import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, ArrowLeft, CalendarRange, Info, Lock, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { AvailabilitySlot, CreateBookingData, DemandPrediction, Hall } from '../types';
import { createBooking, getHall, getHallAvailability, predictDemand } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { toLocalDateTimeInputValue } from '../utils/date';
import { hasValidationErrors, validateBookingForm } from '../utils/validation';

export function HallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [hall, setHall] = useState<Hall | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<CreateBookingData>({
    hall_id: Number(id),
    start_time: '',
    end_time: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<'start_time' | 'end_time', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [prediction, setPrediction] = useState<DemandPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityUnsupported, setAvailabilityUnsupported] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const latestPredictionDateRef = useRef('');

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

  const runPrediction = async (date: string) => {
    if (!id || !date) return;

    latestPredictionDateRef.current = date;
    setPredictionLoading(true);
    setPrediction(null);
    try {
      const nextPrediction = await predictDemand(Number(id), date);
      if (latestPredictionDateRef.current === date) {
        setPrediction(nextPrediction);
      }
    } catch (error) {
      if (latestPredictionDateRef.current === date) {
        toast.error('Не удалось получить прогноз спроса.');
      }
    } finally {
      if (latestPredictionDateRef.current === date) {
        setPredictionLoading(false);
      }
    }
  };

  const loadAvailability = async (date: string) => {
    if (!id || !date) {
      setAvailabilitySlots([]);
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

  const updateField = (field: 'start_time' | 'end_time', value: string) => {
    const next = { ...bookingData, [field]: value };
    setBookingData(next);

    const nextErrors = validateBookingForm(next);
    setFormErrors(nextErrors);
  };

  const applySlotToForm = (slot: AvailabilitySlot) => {
    if (!slot.available || !availabilityDate) return;

    const start = `${availabilityDate}T${slot.start.slice(0, 5)}`;
    const end = `${availabilityDate}T${slot.end.slice(0, 5)}`;
    const next = { ...bookingData, start_time: start, end_time: end };
    setBookingData(next);
    setFormErrors(validateBookingForm(next));
  };

  useEffect(() => {
    const selectedDate = bookingData.start_time.split('T')[0] || '';

    if (!selectedDate) {
      latestPredictionDateRef.current = '';
      setPrediction(null);
      setPredictionLoading(false);
      setAvailabilityDate('');
      setAvailabilitySlots([]);
      return;
    }

    setAvailabilityDate(selectedDate);
    void runPrediction(selectedDate);
    void loadAvailability(selectedDate);
  }, [bookingData.start_time, id]);

  useEffect(() => {
    if (!availabilityDate || !id) return;

    const intervalId = window.setInterval(() => {
      void loadAvailability(availabilityDate);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [availabilityDate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Для бронирования нужно войти в аккаунт');
      navigate('/login');
      return;
    }

    const nextErrors = validateBookingForm(bookingData);
    setFormErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      toast.error('Исправьте ошибки в форме бронирования.');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(bookingData);
      toast.success('Бронирование создано! Перейдите в раздел "Мои бронирования" для оплаты.');
      navigate('/checkout');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось создать бронирование');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateDuration = () => {
    if (!bookingData.start_time || !bookingData.end_time) return 0;
    const start = new Date(bookingData.start_time);
    const end = new Date(bookingData.end_time);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours);
  };

  const calculateTotal = () => {
    if (!hall) return 0;
    return calculateDuration() * hall.price_per_hour;
  };

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

  const duration = calculateDuration();
  const total = calculateTotal();
  const selectedSlotKey = (() => {
    if (!bookingData.start_time || !bookingData.end_time) return '';
    const start = bookingData.start_time.split('T')[1]?.slice(0, 5) || '';
    const end = bookingData.end_time.split('T')[1]?.slice(0, 5) || '';
    return start && end ? `${start}-${end}` : '';
  })();
  const selectedSlotSummary = (() => {
    if (!availabilitySlots.length) return null;
    if (!selectedSlotKey) return null;
    return (
      availabilitySlots.find(
        (slot) => `${slot.start.slice(0, 5)}-${slot.end.slice(0, 5)}` === selectedSlotKey,
      ) ?? null
    );
  })();

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

              <Alert className="border-[#111111]/8 bg-white/70 text-left">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  После создания бронирования у вас будет 24 часа на оплату. Неоплаченные бронирования автоматически
                  отменяются.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 text-center sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111] sm:text-3xl">Забронировать зал</CardTitle>
              <CardDescription className="text-base leading-7 text-[#5c5c5c]">
                Выберите дату и время. Интерфейс сразу подскажет базовые ошибки ещё до отправки запроса на сервер.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="start_time" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
                    Начало
                  </Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={bookingData.start_time}
                    onChange={(e) => updateField('start_time', e.target.value)}
                    aria-invalid={!!formErrors.start_time}
                    min={toLocalDateTimeInputValue(new Date())}
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-center text-sm sm:h-12 sm:text-base"
                  />
                  {formErrors.start_time && <p className="text-center text-sm text-rose-600">{formErrors.start_time}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
                    Конец
                  </Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={bookingData.end_time}
                    onChange={(e) => updateField('end_time', e.target.value)}
                    aria-invalid={!!formErrors.end_time}
                    min={bookingData.start_time || toLocalDateTimeInputValue(new Date())}
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-center text-sm sm:h-12 sm:text-base"
                  />
                  {formErrors.end_time && <p className="text-center text-sm text-rose-600">{formErrors.end_time}</p>}
                </div>

                {!isAuthenticated && (
                  <Alert className="border-[#111111]/8 bg-white/70">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>Чтобы завершить бронирование, сначала войдите в аккаунт.</AlertDescription>
                  </Alert>
                )}

                {duration > 0 && (
                  <div className="rounded-[1.5rem] border border-[#111111]/8 bg-white/70 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4 text-sm text-[#5c5c5c]">
                      <span>Длительность</span>
                      <span className="font-medium text-[#111111]">{duration.toFixed(1)} ч.</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 text-sm text-[#5c5c5c]">
                      <span>Стоимость часа</span>
                      <span className="font-medium text-[#111111]">{hall.price_per_hour} ₽</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#111111]/8 pt-3">
                      <span className="text-lg text-[#111111]">Итого</span>
                      <span className="text-xl text-[#111111] sm:text-2xl">{total.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                )}

                <Button type="submit" className="h-11 w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12" disabled={submitting || !duration}>
                  {submitting ? 'Бронирование...' : 'Забронировать'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 text-center sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111] sm:text-3xl">Прогноз загрузки</CardTitle>
              <CardDescription className="text-base text-[#5c5c5c]">
                {prediction?.date
                  ? `Прогноз рассчитан для даты ${new Date(`${prediction.date}T12:00:00`).toLocaleDateString('ru-RU')}.`
                  : 'Появляется после выбора даты начала бронирования.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              {predictionLoading && <p className="text-center text-sm text-[#5c5c5c]">Собираем прогноз по выбранной дате...</p>}

              {!predictionLoading && prediction && (
                <Alert className="border-[#111111]/8 bg-white/70">
                  {prediction.prediction === 'HIGH' ? <TrendingUp className="h-4 w-4 text-[#111111]" /> : <TrendingDown className="h-4 w-4 text-[#111111]" />}
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong>Статус:</strong> {prediction.prediction === 'HIGH' ? 'Высокий спрос' : 'Низкий спрос'}
                    </p>
                    <p>
                      <strong>Ожидаемые заказы:</strong> {prediction.predicted_orders}
                    </p>
                    <p>
                      <strong>Пояснение:</strong> {prediction.explanation}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {!predictionLoading && !prediction && (
                <Alert className="border-dashed border-[#111111]/12 bg-white/60">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Выберите дату начала, чтобы увидеть прогноз загрузки и пояснение.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 text-center sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl text-[#111111] sm:text-3xl">
                <CalendarRange className="h-5 w-5" />
                Свободные интервалы
              </CardTitle>
              <CardDescription className="text-base leading-7 text-[#5c5c5c]">
                Выбирайте свободный слот кликом: время автоматически подставится в форму. Занятые слоты скрывают детали
                и помечаются как «Занято».
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="space-y-2">
                <Label htmlFor="availability-date" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
                  Проверить дату
                </Label>
                <Input
                  id="availability-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={availabilityDate}
                  onChange={(e) => {
                    setAvailabilityDate(e.target.value);
                    loadAvailability(e.target.value);
                  }}
                  className="h-11 rounded-full border-[#111111]/12 bg-white text-center text-sm sm:h-12 sm:text-base"
                />
              </div>

              {availabilityLoading && <p className="text-center text-sm text-[#5c5c5c]">Загружаем слоты на выбранную дату...</p>}

              {!availabilityLoading && availabilitySlots.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availabilitySlots.map((slot) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      onClick={() => applySlotToForm(slot)}
                      disabled={!slot.available}
                      className={`booking-slot rounded-[1.2rem] border px-4 py-3 text-center text-sm ${
                        slot.available ? 'booking-slot--free border-[#111111]/10 text-[#111111]' : 'booking-slot--busy border-[#111111]/8 text-[#555555]'
                      } ${
                        selectedSlotKey === `${slot.start.slice(0, 5)}-${slot.end.slice(0, 5)}` ? 'booking-slot--selected' : ''
                      }`}
                    >
                      {slot.start.slice(0, 5)} - {slot.end.slice(0, 5)} · {slot.available ? 'Свободно' : 'Занято'}
                    </button>
                  ))}
                </div>
              )}

              {!availabilityLoading && availabilityUnsupported && (
                <Alert className="border-[#111111]/8 bg-white/70">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Endpoint доступности пока не подключён на сервере. Бронирование всё равно защищено серверной
                    проверкой пересечений.
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
