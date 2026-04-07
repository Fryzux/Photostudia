import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BarChart3, Building2, Calendar, DollarSign, Edit2, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { Analytics, CreateHallData, Hall } from '../types';
import { createHall, deleteHall, getAnalytics, getHalls, updateHall } from '../services/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { hasValidationErrors, validateHallForm } from '../utils/validation';

const emptyHallForm: CreateHallData = {
  name: '',
  price_per_hour: 0,
  capacity: 1,
};

export function AdminPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [hallDialog, setHallDialog] = useState<{ open: boolean; hall: Hall | null }>({ open: false, hall: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; hallId: number | null }>({ open: false, hallId: null });
  const [hallFormData, setHallFormData] = useState<CreateHallData>(emptyHallForm);
  const [hallFormErrors, setHallFormErrors] = useState<Partial<Record<'name' | 'price_per_hour' | 'capacity', string>>>({});
  const [hallQuery, setHallQuery] = useState('');
  const [hallSort, setHallSort] = useState('name');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsData, hallsData] = await Promise.all([getAnalytics(), getHalls()]);
        setAnalytics(analyticsData);
        setHalls(hallsData);
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const reloadData = async () => {
    const [analyticsData, hallsData] = await Promise.all([getAnalytics(), getHalls()]);
    setAnalytics(analyticsData);
    setHalls(hallsData);
  };

  const openHallDialog = (hall: Hall | null = null) => {
    setHallFormErrors({});
    if (hall) {
      setHallFormData({
        name: hall.name,
        price_per_hour: hall.price_per_hour,
        capacity: hall.capacity,
      });
    } else {
      setHallFormData(emptyHallForm);
    }

    setHallDialog({ open: true, hall });
  };

  const handleHallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validateHallForm(hallFormData);
    setHallFormErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      toast.error('Исправьте ошибки в форме зала.');
      return;
    }

    setSubmitting(true);
    try {
      if (hallDialog.hall) {
        await updateHall(hallDialog.hall.id, hallFormData);
        toast.success('Зал обновлён');
      } else {
        await createHall(hallFormData);
        toast.success('Зал создан');
      }
      setHallDialog({ open: false, hall: null });
      await reloadData();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения зала');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHall = async () => {
    if (!deleteDialog.hallId) return;

    setDeleting(true);
    try {
      await deleteHall(deleteDialog.hallId);
      toast.success('Зал удалён');
      setDeleteDialog({ open: false, hallId: null });
      await reloadData();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось удалить зал');
    } finally {
      setDeleting(false);
    }
  };

  const filteredHalls = halls
    .filter((hall) => hall.name.toLowerCase().includes(hallQuery.toLowerCase()) || hall.description.toLowerCase().includes(hallQuery.toLowerCase()))
    .sort((left, right) => {
      if (hallSort === 'price-desc') return right.price_per_hour - left.price_per_hour;
      if (hallSort === 'capacity-desc') return right.capacity - left.capacity;
      return left.name.localeCompare(right.name, 'ru');
    });

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Администрирование</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Управление студией, аналитикой и доступом</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Здесь собраны инструменты администратора: аналитика, CRUD по залам и переход к журналу действий пользователей.
        </p>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap rounded-[1.5rem] bg-[#efefec] p-1">
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="halls">Управление залами</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total_users}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего залов</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total_halls}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего бронирований</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total_bookings}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Общий доход</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total_revenue.toLocaleString('ru-RU')} ₽</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="mono-panel border border-[#111111]/8">
              <CardHeader>
                <CardTitle>Общая статистика</CardTitle>
                <CardDescription>Сводная информация о текущем состоянии предметной области.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b py-2">
                  <span className="text-gray-600">Средний доход с бронирования:</span>
                  <span className="font-semibold">
                    {analytics && analytics.total_bookings > 0
                      ? Math.round(analytics.total_revenue / analytics.total_bookings).toLocaleString('ru-RU')
                      : 0}{' '}
                    ₽
                  </span>
                </div>
                <div className="flex items-center justify-between border-b py-2">
                  <span className="text-gray-600">Активных залов:</span>
                  <span className="font-semibold">{halls.length}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Средняя цена за час:</span>
                  <span className="font-semibold">
                    {halls.length > 0
                      ? Math.round(halls.reduce((sum, hall) => sum + hall.price_per_hour, 0) / halls.length).toLocaleString('ru-RU')
                      : 0}{' '}
                    ₽
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="mono-panel border border-[#111111]/8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#111111]" />
                  Аудит и контроль
                </CardTitle>
                <CardDescription>Переход к журналу действий для проверки требований по безопасности.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">
                  Просматривайте события входа, создания и удаления бронирований, фильтруйте их по дате и пользователю.
                </p>
                <Link to="/admin/audit">
                  <Button className="w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">Открыть журнал действий</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="halls" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle>Фильтры и управление</CardTitle>
              <CardDescription>Администратор может искать залы, сортировать их и открывать CRUD-операции.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_220px_180px]">
              <div className="space-y-2">
                <Label htmlFor="hall-query" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск по залам</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="hall-query"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="Название или описание"
                    value={hallQuery}
                    onChange={(e) => setHallQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hall-sort" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Сортировка</Label>
                <Select value={hallSort} onValueChange={setHallSort}>
                  <SelectTrigger id="hall-sort" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                    <SelectValue placeholder="По названию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">По названию</SelectItem>
                    <SelectItem value="price-desc">По цене</SelectItem>
                    <SelectItem value="capacity-desc">По вместимости</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={() => openHallDialog()} className="h-11 w-full gap-2 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12">
                  <Plus className="h-4 w-4" />
                  Добавить зал
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredHalls.map((hall) => (
              <Card key={hall.id} className="mono-panel border border-[#111111]/8">
                <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{hall.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">{hall.description}</CardDescription>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]" onClick={() => openHallDialog(hall)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]" onClick={() => setDeleteDialog({ open: true, hallId: hall.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-gray-600">Цена:</span> <span className="font-medium">{hall.price_per_hour} ₽/час</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Вместимость:</span> <span className="font-medium">{hall.capacity} чел.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredHalls.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center text-slate-500">
                По текущему запросу залы не найдены.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={hallDialog.open} onOpenChange={(open) => setHallDialog((current) => ({ open, hall: open ? current.hall : null }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{hallDialog.hall ? 'Редактировать зал' : 'Добавить новый зал'}</DialogTitle>
            <DialogDescription>Укажите базовые параметры зала. Поля проверяются на клиенте до сохранения.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleHallSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={hallFormData.name}
                onChange={(e) => setHallFormData({ ...hallFormData, name: e.target.value })}
                aria-invalid={!!hallFormErrors.name}
                placeholder="Студия Модерн"
              />
              {hallFormErrors.name && <p className="text-sm text-rose-600">{hallFormErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Цена за час (₽)</Label>
                <Input
                  id="price"
                  type="number"
                  value={hallFormData.price_per_hour}
                  onChange={(e) => setHallFormData({ ...hallFormData, price_per_hour: Number(e.target.value) })}
                  aria-invalid={!!hallFormErrors.price_per_hour}
                  min="1"
                />
                {hallFormErrors.price_per_hour && <p className="text-sm text-rose-600">{hallFormErrors.price_per_hour}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Вместимость (чел.)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={hallFormData.capacity}
                  onChange={(e) => setHallFormData({ ...hallFormData, capacity: Number(e.target.value) })}
                  aria-invalid={!!hallFormErrors.capacity}
                  min="1"
                />
                {hallFormErrors.capacity && <p className="text-sm text-rose-600">{hallFormErrors.capacity}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHallDialog({ open: false, hall: null })}>
                Отмена
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((current) => ({ open, hallId: open ? current.hallId : null }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить зал?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие затронет данные предметной области. Убедитесь, что зал больше не нужен.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHall} disabled={deleting}>
              {deleting ? 'Удаляем...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
