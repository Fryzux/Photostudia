import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { ForecastHeatmapCell, ForecastResult, Hall } from '../types';
import { getForecast, getHalls } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePickerInput } from '../components/ui/date-picker-input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function getLoadToneClass(loadPercent: number) {
  if (loadPercent >= 80) return 'bg-foreground text-background border-[#111111]';
  if (loadPercent >= 60) return 'bg-[#3a3a3a] text-white border-[#3a3a3a]';
  if (loadPercent >= 40) return 'bg-[#7a7a7a] text-white border-[#7a7a7a]';
  if (loadPercent >= 20) return 'bg-[#d8d8d3] text-foreground border-[#c8c8c2]';
  return 'bg-[#f3f3f0] text-muted-foreground border-[#ddddda]';
}

export function AiInsightsPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(() => toIsoDate(new Date()));
  const [dateTo, setDateTo] = useState(() => toIsoDate(addDays(new Date(), 6)));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hallsError, setHallsError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  const loadHalls = async () => {
    setLoading(true);
    setHallsError(null);
    try {
      const hallsData = await getHalls();
      setHalls(hallsData);
      setSelectedHallId((current) => {
        if (current && hallsData.some((hall) => String(hall.id) === current)) {
          return current;
        }
        return hallsData[0] ? String(hallsData[0].id) : '';
      });
    } catch {
      const message = 'Не удалось загрузить список залов для AI-модуля.';
      setHallsError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHalls();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedHallId) {
      toast.error('Сначала выберите зал.');
      return;
    }

    if (!dateFrom || !dateTo) {
      toast.error('Выберите период прогноза.');
      return;
    }

    if (dateFrom > dateTo) {
      toast.error('Дата окончания должна быть позже даты начала.');
      return;
    }

    setSubmitting(true);
    setForecast(null);
    try {
      const result = await getForecast({
        hall_id: Number(selectedHallId),
        date_from: dateFrom,
        date_to: dateTo,
      });
      setForecast(result);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось построить прогноз загрузки.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHall = halls.find((hall) => String(hall.id) === selectedHallId) ?? null;

  const heatmapMap = useMemo(() => {
    const map = new Map<string, ForecastHeatmapCell>();
    if (!forecast) return map;

    forecast.heatmap.forEach((cell) => {
      map.set(`${cell.date}-${cell.hour}`, cell);
    });
    return map;
  }, [forecast]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section data-reveal="section" className="reveal-section mono-panel overflow-hidden rounded-[2rem] border border-border p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-muted-foreground">AI-модуль</p>
        <h1 className="mb-3 text-4xl text-foreground sm:text-5xl">Прогноз загрузки по периоду</h1>
        <p className="max-w-3xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
          Выберите студию и период, чтобы увидеть тепловую карту загрузки: по оси X дни, по оси Y часы, цвет показывает
          процент ожидаемой загрузки.
        </p>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card data-reveal="section" className="reveal-section mono-panel border border-border">
          <CardContent className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            {hallsError && (
              <div className="mb-4 rounded-[1.2rem] border border-dashed border-[#111111]/15 bg-card/70 p-4 text-sm text-muted-foreground">
                <p>{hallsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 rounded-full border-border bg-card text-foreground hover:bg-accent"
                  onClick={() => void loadHalls()}
                >
                  Повторить загрузку
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="hall-select" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                  Студия
                </Label>
                <Select disabled={loading || halls.length === 0} value={selectedHallId} onValueChange={setSelectedHallId}>
                  <SelectTrigger id="hall-select" className="h-11 rounded-full border-border bg-card text-sm sm:h-12 sm:text-base">
                    <SelectValue placeholder="Выберите зал" />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map((hall) => (
                      <SelectItem key={hall.id} value={String(hall.id)}>
                        {hall.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="forecast-from" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                    Начало периода
                  </Label>
                  <DatePickerInput id="forecast-from" value={dateFrom} min={toIsoDate(new Date())} onChange={setDateFrom} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forecast-to" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                    Конец периода
                  </Label>
                  <DatePickerInput id="forecast-to" value={dateTo} min={dateFrom || toIsoDate(new Date())} onChange={setDateTo} />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90 sm:h-12"
                disabled={loading || submitting || !selectedHallId}
              >
                <Sparkles className="h-4 w-4" />
                {submitting ? 'Строим прогноз...' : 'Построить прогноз'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card data-reveal="section" className="reveal-section mono-panel border border-border">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="text-2xl text-foreground">Легенда загрузки</CardTitle>
            <CardDescription className="text-muted-foreground">Чем темнее ячейка, тем выше ожидаемая загрузка этого часа.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 text-sm sm:px-6 sm:pb-6">
            {[
              { label: '80–100% · Пиковая загрузка', tone: 'bg-foreground text-background border-[#111111]' },
              { label: '60–79% · Высокая загрузка', tone: 'bg-[#3a3a3a] text-white border-[#3a3a3a]' },
              { label: '40–59% · Средняя загрузка', tone: 'bg-[#7a7a7a] text-white border-[#7a7a7a]' },
              { label: '20–39% · Низкая загрузка', tone: 'bg-[#d8d8d3] text-foreground border-[#c8c8c2]' },
              { label: '0–19% · Свободное окно', tone: 'bg-[#f3f3f0] text-muted-foreground border-[#ddddda]' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-[1rem] border border-border bg-card/70 p-3">
                <span className={`inline-block h-5 w-5 rounded-md border ${item.tone}`} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {forecast && selectedHall && (
        <section data-reveal="section" className="reveal-section space-y-6">
          <Card className="mono-panel border border-border">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
                <CalendarDays className="h-5 w-5 text-foreground" />
                Тепловая карта загрузки
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {selectedHall.name} · {forecast.date_from} — {forecast.date_to}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
                  <p className="text-sm text-muted-foreground">Средняя загрузка</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{forecast.summary.average_load_percent}%</p>
                </div>
                <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
                  <p className="text-sm text-muted-foreground">Средняя уверенность</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{Math.round(forecast.summary.average_confidence * 100)}%</p>
                </div>
                <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
                  <p className="text-sm text-muted-foreground">Пиковый час</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {forecast.summary.peak ? `${forecast.summary.peak.hour.toString().padStart(2, '0')}:00` : '—'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[860px] space-y-2">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `120px repeat(${forecast.days.length}, minmax(92px, 1fr))` }}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-[#7a7a7a]">Часы</div>
                    {forecast.days.map((day) => (
                      <div key={day} className="rounded-xl border border-border bg-card/70 px-2 py-2 text-center">
                        <p className="text-xs uppercase tracking-[0.18em] text-[#7a7a7a]">{format(parseISO(day), 'EEE', { locale: ru })}</p>
                        <p className="text-sm font-medium text-foreground">{format(parseISO(day), 'dd.MM')}</p>
                      </div>
                    ))}
                  </div>

                  {forecast.hours.map((hour) => (
                    <div
                      key={hour}
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `120px repeat(${forecast.days.length}, minmax(92px, 1fr))` }}
                    >
                      <div className="flex items-center justify-center rounded-xl border border-border bg-card/70 px-2 py-2 text-sm text-muted-foreground">
                        {hour.toString().padStart(2, '0')}:00
                      </div>

                      {forecast.days.map((day) => {
                        const cell = heatmapMap.get(`${day}-${hour}`);
                        const load = cell?.load_percent ?? 0;
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className={`rounded-xl border px-2 py-2 text-center text-sm font-medium ${getLoadToneClass(load)}`}
                            title={`${format(parseISO(day), 'dd.MM.yyyy')} ${hour.toString().padStart(2, '0')}:00 · ${load}%`}
                          >
                            {load}%
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-border bg-card/70 p-5">
                <p className="mb-3 text-sm font-medium text-foreground">Рекомендации по расписанию</p>
                <div className="space-y-2 text-sm text-[#4e4e4e]">
                  {forecast.recommendations.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
