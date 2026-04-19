import { useEffect, useState } from 'react';
import { BadgePercent, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';

import type { CreatePromoCodeData, DailyForecast, Hall, HourlySlot } from '../types';
import { createPromoCode, getHalls, getWeeklyForecast } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function ManagerPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(false);

  const [promoDialog, setPromoDialog] = useState<{
    open: boolean;
    date: string;
    slot: HourlySlot | null;
  }>({ open: false, date: '', slot: null });

  const [promoData, setPromoData] = useState<Partial<CreatePromoCodeData>>({
    discount_percent: 30,
  });
  const [creatingPromo, setCreatingPromo] = useState(false);

  useEffect(() => {
    const loadHalls = async () => {
      try {
        const hallsData = await getHalls();
        setHalls(hallsData);
        if (hallsData.length > 0) {
          setSelectedHallId(hallsData[0].id);
        }
      } catch (error) {
        toast.error('Не удалось загрузить залы');
      } finally {
        setLoading(false);
      }
    };
    loadHalls();
  }, []);

  useEffect(() => {
    if (!selectedHallId) return;

    const loadForecast = async () => {
      setLoadingForecast(true);
      try {
        const data = await getWeeklyForecast(selectedHallId);
        setForecast(data);
      } catch (error: any) {
        toast.error(error.message || 'Ошибка загрузки прогноза');
      } finally {
        setLoadingForecast(false);
      }
    };
    loadForecast();
  }, [selectedHallId]);

  const handleOpenPromoDialog = (date: string, slot: HourlySlot) => {
    setPromoDialog({ open: true, date, slot });
    setPromoData({
      hall: selectedHallId!,
      discount_percent: 30,
      hour_from: slot.hour,
      hour_to: slot.hour + 1,
      valid_from: `${date}T00:00`,
      valid_to: `${date}T23:59`,
    });
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoData.hall || !promoData.valid_from || !promoData.valid_to) return;

    setCreatingPromo(true);
    try {
      await createPromoCode(promoData as CreatePromoCodeData);
      toast.success('Промокод успешно создан и опубликован!');
      setPromoDialog({ open: false, date: '', slot: null });
    } catch (error: any) {
      toast.error(error.message || 'Ошибка создания промокода');
    } finally {
      setCreatingPromo(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="mono-panel rounded-[2rem] border border-[#111111]/8 px-5 py-8 text-center sm:px-8 sm:py-10">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Менеджер</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Планирование загрузки</h1>
        <p className="mx-auto max-w-2xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Анализируйте AI-прогнозы спроса на неделю вперёд и создавайте акции для часов с низкой вероятностью бронирования.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Выбор зала</h2>
        <div className="w-full sm:w-72">
          <Select value={selectedHallId?.toString()} onValueChange={(val) => setSelectedHallId(Number(val))}>
            <SelectTrigger className="h-12 rounded-full border-[#111111]/12 bg-white text-base">
              <SelectValue placeholder="Выберите зал" />
            </SelectTrigger>
            <SelectContent>
              {halls.map((hall) => (
                <SelectItem key={hall.id} value={hall.id.toString()}>
                  {hall.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mono-panel overflow-hidden border border-[#111111]/8">
        <CardHeader className="bg-[#f8f8f5] px-5 sm:px-8">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle>Тепловая карта загрузки (7 дней)</CardTitle>
          </div>
          <CardDescription>
            Чем насыщеннее красный цвет, тем ниже спрос. Нажимайте на слоты, чтобы создать промокод.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loadingForecast ? (
            <div className="p-8">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : forecast.length > 0 ? (
            <div className="min-w-[800px] border-t border-[#111111]/5">
              <div className="grid grid-cols-13 divide-x divide-[#111111]/5 border-b border-[#111111]/5 bg-gray-50 text-sm font-medium">
                <div className="p-4 text-center text-slate-500">Время</div>
                {forecast.map((day) => (
                  <div key={day.date} className="p-4 text-center">
                    <div className="text-slate-900">{day.day_label}</div>
                    <div className="text-xs text-slate-500">{day.date.split('-').slice(1).join('.')}</div>
                  </div>
                ))}
              </div>

              {/* Часы по вертикали */}
              {forecast[0].slots.map((slot, slotIdx) => (
                <div key={slot.hour} className="grid grid-cols-13 divide-x divide-[#111111]/5 border-b border-[#111111]/5 last:border-0 hover:bg-slate-50/50">
                  <div className="flex items-center justify-center p-3 text-xs font-medium text-slate-500">
                    {slot.label}
                  </div>
                  {forecast.map((day) => {
                    const currentSlot = day.slots[slotIdx];
                    const prob = currentSlot.booking_probability;
                    
                    // Цветовое кодирование спроса
                    let bgColor = 'bg-green-100/50 hover:bg-green-100'; // Высокий
                    let textColor = 'text-green-700';
                    if (prob < 0.6) {
                      bgColor = 'bg-yellow-50 hover:bg-yellow-100/50'; // Средний
                      textColor = 'text-yellow-700';
                    }
                    if (prob < 0.3) {
                      bgColor = 'bg-red-100/60 hover:bg-red-200/60 cursor-pointer transition-colors'; // Низкий
                      textColor = 'text-red-700 font-bold';
                    }

                    const isLowDemand = prob < 0.3;

                    return (
                      <div
                        key={day.date}
                        className={`flex flex-col items-center justify-center gap-1 p-2 ${bgColor}`}
                        onClick={() => isLowDemand && handleOpenPromoDialog(day.date, currentSlot)}
                        title={isLowDemand ? 'Нажмите, чтобы создать акцию' : 'Нажмите недоступно'}
                      >
                        <span className={`text-xs ${textColor}`}>{(prob * 100).toFixed(0)}%</span>
                        {isLowDemand && (
                          <Plus className="h-3 w-3 text-red-500 opacity-50" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">Нет данных для отображения.</div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={promoDialog.open}
        onOpenChange={(open) => setPromoDialog((cur) => ({ ...cur, open }))}
      >
        <DialogContent className="border border-[#111111]/10 bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-[#111111]" />
              Создать акцию для стимуляции спроса
            </DialogTitle>
            <DialogDescription>
              На {promoDialog.date} (Слот {promoDialog.slot?.label}) прогнозируется крайне низкий спрос.
              Сгенерируйте автоматический промокод, чтобы привлечь клиентов.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePromo} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Скидка (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="5"
                  max="50"
                  value={promoData.discount_percent}
                  onChange={(e) => setPromoData({ ...promoData, discount_percent: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Зал</Label>
                <Input value={halls.find(h => h.id === promoData.hall)?.name || ''} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Срок действия промокода</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="datetime-local"
                  value={promoData.valid_from}
                  onChange={(e) => setPromoData({ ...promoData, valid_from: e.target.value })}
                />
                <Input
                  type="datetime-local"
                  value={promoData.valid_to}
                  onChange={(e) => setPromoData({ ...promoData, valid_to: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Промокод будет автоматически сгенерирован и опубликован на странице зала до конца срока действия.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setPromoDialog({ open: false, date: '', slot: null })}>
                Отмена
              </Button>
              <Button type="submit" className="rounded-full bg-[#111111] text-white" disabled={creatingPromo}>
                {creatingPromo ? 'Генерация...' : 'Опубликовать промокод'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
