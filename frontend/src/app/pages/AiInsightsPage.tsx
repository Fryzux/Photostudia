import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarDays, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import type { DemandPrediction, Hall } from '../types';
import { getHalls, predictDemand } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const defaultForecastDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function AiInsightsPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [date, setDate] = useState(defaultForecastDate);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prediction, setPrediction] = useState<DemandPrediction | null>(null);

  useEffect(() => {
    const loadHalls = async () => {
      try {
        const hallsData = await getHalls();
        setHalls(hallsData);
        if (hallsData[0]) {
          setSelectedHallId(String(hallsData[0].id));
        }
      } catch (error) {
        toast.error('Не удалось загрузить список залов для AI-модуля.');
      } finally {
        setLoading(false);
      }
    };

    loadHalls();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedHallId) {
      toast.error('Сначала выберите зал.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await predictDemand(Number(selectedHallId), date);
      setPrediction(result);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось получить прогноз.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHall = halls.find((hall) => String(hall.id) === selectedHallId);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">AI-модуль</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Прогноз спроса и пояснение результата</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Страница показывает результат работы модели в понятном виде: ожидаемую нагрузку, текстовое объяснение и
          рекомендацию по работе с расписанием.
        </p>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
              <BrainCircuit className="h-5 w-5 text-[#111111]" />
              Запрос к модели
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">Выберите зал и дату, чтобы получить результат работы AI-модуля.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="hall-select" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Зал</Label>
                <Select disabled={loading || halls.length === 0} value={selectedHallId} onValueChange={setSelectedHallId}>
                  <SelectTrigger id="hall-select" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
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

              <div className="space-y-2">
                <Label htmlFor="forecast-date" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Дата прогноза</Label>
                <Input
                  id="forecast-date"
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                />
              </div>

              <Button type="submit" className="h-11 w-full gap-2 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12" disabled={loading || submitting || !selectedHallId}>
                <Sparkles className="h-4 w-4" />
                {submitting ? 'Формируем прогноз...' : 'Получить прогноз'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="text-2xl text-[#111111]">Что показывает результат</CardTitle>
            <CardDescription className="text-[#5c5c5c]">Этот блок помогает объяснить пользователю, как интерпретировать ответ модели.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 text-sm text-[#5c5c5c] sm:px-6 sm:pb-6">
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <p className="font-medium text-[#111111]">Выход модели</p>
              <p>Ожидаемое количество заказов на выбранную дату и объяснение факторов спроса.</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <p className="font-medium text-[#111111]">Пояснение результата</p>
              <p>Фронтенд преобразует числовой прогноз в понятный статус и рекомендацию для планирования загрузки.</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <p className="font-medium text-[#111111]">Повторное использование модели</p>
              <p>Результат запрашивается через серверный API, который использует сохраненный файл модели без повторного обучения.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {prediction && selectedHall && (
        <section className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                {prediction.prediction === 'HIGH' ? (
                  <TrendingUp className="h-5 w-5 text-[#111111]" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-[#111111]" />
                )}
                Результат прогноза
              </CardTitle>
              <CardDescription className="text-[#5c5c5c]">
                {selectedHall.name} · <CalendarDays className="mb-0.5 inline h-4 w-4" /> {prediction.date}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                  <p className="text-sm text-[#5c5c5c]">Ожидаемый спрос</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111111]">
                    {prediction.prediction === 'HIGH' ? 'Высокий' : 'Низкий'}
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                  <p className="text-sm text-[#5c5c5c]">Прогноз заказов</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111111]">{prediction.predicted_orders}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                  <p className="text-sm text-[#5c5c5c]">Уверенность</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111111]">{Math.round(prediction.confidence * 100)}%</p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-5">
                <p className="mb-2 text-sm font-medium text-[#111111]">Пояснение результата</p>
                <p className="text-[#4e4e4e]">{prediction.explanation || 'Модель не вернула текстовое объяснение.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111]">Рекомендация интерфейса</CardTitle>
              <CardDescription className="text-[#5c5c5c]">Фронтенд должен показывать не только цифру, но и действие, которое она подсказывает.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 text-sm text-[#5c5c5c] sm:px-6 sm:pb-6">
              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="font-medium text-[#111111]">Для пользователя</p>
                <p>
                  {prediction.prediction === 'HIGH'
                    ? 'Рекомендуется бронировать слот заранее и подтверждать оплату без задержек.'
                    : 'Дата выглядит спокойной: можно предложить гибкие временные окна и дополнительные услуги.'}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="font-medium text-[#111111]">Для администратора</p>
                <p>
                  {prediction.prediction === 'HIGH'
                    ? 'Стоит подготовить персонал, проверить доступность зала и загрузку расписания.'
                    : 'Можно использовать дату для акций, тестовых съемок или перераспределения нагрузки.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
