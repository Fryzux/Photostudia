import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Activity, BarChart3, Building2, Calendar, DollarSign, Edit2, Plus, Search, ShieldCheck, TicketPercent, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type {
  Analytics,
  AuditLog,
  CreateHallData,
  CreatePromoCodeData,
  CreateStudioServiceData,
  Hall,
  Order,
  PromoCode,
  StudioService,
  User,
} from '../types';
import {
  activatePromoCode,
  createHall,
  createPromoCode,
  deactivatePromoCode,
  deleteHall,
  getActionLogs,
  getAnalytics,
  getHalls,
  getOrders,
  getPromoCodes,
  getUsers,
  updateHall,
  updateOrderStatus,
} from '../services/api';
import { createStudioService, deleteStudioService, getStudioServices, updateStudioService } from '../services/studioServices';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePickerInput } from '../components/ui/date-picker-input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { hasValidationErrors, validateHallForm } from '../utils/validation';

const emptyHallForm: CreateHallData = {
  name: '',
  price_per_hour: 0,
  capacity: 1,
};

const emptyPromoForm: CreatePromoCodeData = {
  code: '',
  description: '',
  discount_percent: 10,
  valid_from: '',
  valid_to: '',
};

const emptyServiceForm: CreateStudioServiceData = {
  name: '',
  description: '',
  price: 0,
  pricing_mode: 'fixed',
  is_active: true,
};

const orderStatuses: Array<Order['status']> = ['PENDING', 'COMPLETED', 'CANCELLED'];

export function AdminPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  const [hallDialog, setHallDialog] = useState<{ open: boolean; hall: Hall | null }>({ open: false, hall: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; hallId: number | null }>({ open: false, hallId: null });
  const [hallFormData, setHallFormData] = useState<CreateHallData>(emptyHallForm);
  const [hallFormErrors, setHallFormErrors] = useState<Partial<Record<'name' | 'price_per_hour' | 'capacity', string>>>({});
  const [hallQuery, setHallQuery] = useState('');
  const [hallSort, setHallSort] = useState('name');
  const [submittingHall, setSubmittingHall] = useState(false);
  const [deletingHall, setDeletingHall] = useState(false);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | Order['status']>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState<'all' | 'staff' | 'client'>('all');

  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  const [promoSearch, setPromoSearch] = useState('');
  const [promoForm, setPromoForm] = useState<CreatePromoCodeData>(emptyPromoForm);
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [updatingPromoId, setUpdatingPromoId] = useState<number | null>(null);

  const [services, setServices] = useState<StudioService[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service: StudioService | null }>({
    open: false,
    service: null,
  });
  const [serviceForm, setServiceForm] = useState<CreateStudioServiceData>(emptyServiceForm);
  const [submittingService, setSubmittingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsData, hallsData, ordersData, usersData, logsData, promosData] = await Promise.all([
          getAnalytics(),
          getHalls(),
          getOrders(),
          getUsers(),
          getActionLogs(),
          getPromoCodes(),
        ]);

        setAnalytics(analyticsData);
        setHalls(hallsData);
        setOrders(ordersData);
        setUsers(usersData);
        setAuditLogs(logsData);
        setPromos(promosData);
        setServices(getStudioServices());
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить данные админ-панели');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const reloadAnalytics = async () => {
    setAnalytics(await getAnalytics());
  };

  const reloadHalls = async () => {
    setHalls(await getHalls());
  };

  const reloadOrders = async () => {
    setOrders(await getOrders());
  };

  const reloadUsers = async () => {
    setUsers(await getUsers());
  };

  const reloadPromos = async () => {
    setPromos(await getPromoCodes());
  };

  const reloadServices = () => {
    setServices(getStudioServices());
  };

  const reloadLogs = async (params: { search?: string; action?: string; date_from?: string; date_to?: string } = {}) => {
    setLogsLoading(true);
    try {
      const payload = await getActionLogs(params);
      setAuditLogs(payload);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось загрузить журнал действий');
    } finally {
      setLogsLoading(false);
    }
  };

  const applyLogFilters = async () => {
    await reloadLogs({
      search: logSearch,
      action: logAction,
      date_from: logDateFrom,
      date_to: logDateTo,
    });
  };

  const resetLogFilters = async () => {
    setLogSearch('');
    setLogAction('all');
    setLogDateFrom('');
    setLogDateTo('');
    await reloadLogs();
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

  const handleHallSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validateHallForm(hallFormData);
    setHallFormErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      toast.error('Исправьте ошибки в форме зала.');
      return;
    }

    setSubmittingHall(true);
    try {
      if (hallDialog.hall) {
        await updateHall(hallDialog.hall.id, hallFormData);
        toast.success('Зал обновлён');
      } else {
        await createHall(hallFormData);
        toast.success('Зал создан');
      }
      setHallDialog({ open: false, hall: null });
      await reloadHalls();
      await reloadAnalytics();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось сохранить зал');
    } finally {
      setSubmittingHall(false);
    }
  };

  const handleDeleteHall = async () => {
    if (!deleteDialog.hallId) return;

    setDeletingHall(true);
    try {
      await deleteHall(deleteDialog.hallId);
      toast.success('Зал удалён');
      setDeleteDialog({ open: false, hallId: null });
      await reloadHalls();
      await reloadAnalytics();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось удалить зал');
    } finally {
      setDeletingHall(false);
    }
  };

  const handleOrderStatusChange = async (orderId: number, statusValue: Order['status']) => {
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, statusValue);
      setOrders((current) => current.map((item) => (item.id === orderId ? updated : item)));
      await reloadAnalytics();
      await reloadLogs();
      toast.success('Статус заказа обновлён');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось обновить статус заказа');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCreatePromo = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCode = promoForm.code.trim().toUpperCase();
    if (!normalizedCode) {
      toast.error('Введите код промокода.');
      return;
    }
    if (promoForm.discount_percent < 1 || promoForm.discount_percent > 100) {
      toast.error('Скидка должна быть в диапазоне от 1 до 100%.');
      return;
    }
    if (promoForm.valid_from && promoForm.valid_to && promoForm.valid_to <= promoForm.valid_from) {
      toast.error('Дата окончания действия должна быть позже даты начала.');
      return;
    }

    setCreatingPromo(true);
    try {
      await createPromoCode({
        ...promoForm,
        code: normalizedCode,
        valid_from: promoForm.valid_from || undefined,
        valid_to: promoForm.valid_to || undefined,
      });
      toast.success('Промокод создан');
      setPromoForm(emptyPromoForm);
      await reloadPromos();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось создать промокод');
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleDeactivatePromo = async (promoId: number) => {
    setUpdatingPromoId(promoId);
    try {
      const nextPromo = await deactivatePromoCode(promoId);
      setPromos((current) => current.map((item) => (item.id === promoId ? nextPromo : item)));
      toast.success('Промокод деактивирован');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось деактивировать промокод');
    } finally {
      setUpdatingPromoId(null);
    }
  };

  const handleActivatePromo = async (promoId: number) => {
    setUpdatingPromoId(promoId);
    try {
      const nextPromo = await activatePromoCode(promoId);
      setPromos((current) => current.map((item) => (item.id === promoId ? nextPromo : item)));
      toast.success('Промокод снова активен');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось активировать промокод');
    } finally {
      setUpdatingPromoId(null);
    }
  };

  const openServiceDialog = (service: StudioService | null = null) => {
    if (service) {
      setServiceForm({
        name: service.name,
        description: service.description || '',
        price: service.price,
        pricing_mode: service.pricing_mode,
        is_active: service.is_active,
      });
    } else {
      setServiceForm(emptyServiceForm);
    }
    setServiceDialog({ open: true, service });
  };

  const handleServiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!serviceForm.name.trim()) {
      toast.error('Укажите название услуги.');
      return;
    }
    if (!Number.isFinite(serviceForm.price) || serviceForm.price < 0) {
      toast.error('Введите корректную стоимость услуги.');
      return;
    }

    setSubmittingService(true);
    try {
      if (serviceDialog.service) {
        updateStudioService(serviceDialog.service.id, {
          name: serviceForm.name,
          description: serviceForm.description,
          price: Number(serviceForm.price),
          pricing_mode: serviceForm.pricing_mode,
          is_active: serviceForm.is_active,
        });
        toast.success('Услуга обновлена');
      } else {
        createStudioService({
          name: serviceForm.name,
          description: serviceForm.description,
          price: Number(serviceForm.price),
          pricing_mode: serviceForm.pricing_mode,
          is_active: serviceForm.is_active,
        });
        toast.success('Услуга добавлена');
      }
      reloadServices();
      setServiceDialog({ open: false, service: null });
      setServiceForm(emptyServiceForm);
    } catch (error: any) {
      toast.error(error.message || 'Не удалось сохранить услугу.');
    } finally {
      setSubmittingService(false);
    }
  };

  const handleServiceDelete = async (serviceId: number) => {
    setDeletingServiceId(serviceId);
    try {
      deleteStudioService(serviceId);
      reloadServices();
      toast.success('Услуга удалена');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось удалить услугу.');
    } finally {
      setDeletingServiceId(null);
    }
  };

  const filteredHalls = useMemo(
    () =>
      halls
        .filter(
          (hall) =>
            hall.name.toLowerCase().includes(hallQuery.toLowerCase()) ||
            (hall.description || '').toLowerCase().includes(hallQuery.toLowerCase()),
        )
        .sort((left, right) => {
          if (hallSort === 'price-desc') return right.price_per_hour - left.price_per_hour;
          if (hallSort === 'capacity-desc') return right.capacity - left.capacity;
          return left.name.localeCompare(right.name, 'ru');
        }),
    [halls, hallQuery, hallSort],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const searchValue = orderSearch.toLowerCase();
        const matchesSearch =
          !searchValue ||
          String(order.id).includes(searchValue) ||
          order.booking.hall.name.toLowerCase().includes(searchValue) ||
          (order.username || '').toLowerCase().includes(searchValue) ||
          (order.user_email || '').toLowerCase().includes(searchValue);

        const matchesStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [orders, orderSearch, orderStatusFilter],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const searchValue = userSearch.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
        const matchesSearch =
          !searchValue ||
          user.username.toLowerCase().includes(searchValue) ||
          user.email.toLowerCase().includes(searchValue) ||
          fullName.includes(searchValue);

        if (userRole === 'staff') return matchesSearch && !!user.is_staff;
        if (userRole === 'client') return matchesSearch && !user.is_staff;
        return matchesSearch;
      }),
    [users, userSearch, userRole],
  );

  const filteredPromos = useMemo(
    () =>
      promos
        .filter(
          (promo) =>
            promo.code.toLowerCase().includes(promoSearch.toLowerCase()) ||
            (promo.description || '').toLowerCase().includes(promoSearch.toLowerCase()),
        )
        .sort((left, right) => Number(right.is_active) - Number(left.is_active)),
    [promos, promoSearch],
  );

  const filteredServices = useMemo(
    () =>
      services.filter(
        (service) =>
          service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
          (service.description || '').toLowerCase().includes(serviceSearch.toLowerCase()),
      ),
    [serviceSearch, services],
  );

  const recentActivity = useMemo(() => auditLogs.slice(0, 5), [auditLogs]);

  const revenueTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    const today = new Date();

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);
      const dayKey = format(date, 'yyyy-MM-dd');
      byDay.set(dayKey, 0);
    }

    orders.forEach((order) => {
      if (order.status !== 'COMPLETED') return;
      const dayKey = format(new Date(order.created_at), 'yyyy-MM-dd');
      if (!byDay.has(dayKey)) return;
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + order.total_amount);
    });

    const points = Array.from(byDay.entries()).map(([dayKey, revenue]) => ({
      dayKey,
      label: format(new Date(`${dayKey}T12:00:00`), 'dd.MM', { locale: ru }),
      revenue,
    }));

    const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
    return points.map((point) => ({
      ...point,
      heightPercent: point.revenue > 0 ? Math.max(10, Math.round((point.revenue / maxRevenue) * 100)) : 0,
    }));
  }, [orders]);

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Администрирование</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Единая панель управления студией</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Вкладки объединяют аналитику, пользователей, заказы, логи аудита, залы и акции в одном интерфейсе.
        </p>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap rounded-[1.5rem] bg-[#efefec] p-1">
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="halls">Залы</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="logs">Логи аудита</TabsTrigger>
          <TabsTrigger value="services">Услуги</TabsTrigger>
          <TabsTrigger value="promos">Акции</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
                  <Users className="h-4 w-4 text-[#5c5c5c]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-[#111111]">{analytics.total_users}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего залов</CardTitle>
                  <Building2 className="h-4 w-4 text-[#5c5c5c]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-[#111111]">{analytics.total_halls}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего бронирований</CardTitle>
                  <Calendar className="h-4 w-4 text-[#5c5c5c]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-[#111111]">{analytics.total_bookings}</div>
                </CardContent>
              </Card>

              <Card className="mono-panel border border-[#111111]/8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Выручка</CardTitle>
                  <DollarSign className="h-4 w-4 text-[#5c5c5c]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-[#111111]">{analytics.total_revenue.toLocaleString('ru-RU')} ₽</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <Card className="mono-panel border border-[#111111]/8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                  <BarChart3 className="h-5 w-5" />
                  Тренд выручки за 7 дней
                </CardTitle>
                <CardDescription className="text-[#5c5c5c]">График построен по оплаченным заказам (`COMPLETED`).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 items-end gap-2">
                  {revenueTrend.map((point) => (
                    <div key={point.dayKey} className="flex flex-col items-center gap-2">
                      <div className="relative h-28 w-full overflow-hidden rounded-xl border border-[#111111]/8 bg-[#efefec]">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-xl bg-[#111111] transition-all duration-500"
                          style={{ height: `${point.heightPercent}%` }}
                        />
                      </div>
                      <p className="text-[0.66rem] uppercase tracking-[0.2em] text-[#666666]">{point.label}</p>
                      <p className="text-[0.66rem] text-[#555555]">{point.revenue > 0 ? `${Math.round(point.revenue).toLocaleString('ru-RU')} ₽` : '—'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mono-panel border border-[#111111]/8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                  <Activity className="h-5 w-5" />
                  Последняя активность
                </CardTitle>
                <CardDescription className="text-[#5c5c5c]">5 свежих событий из журнала аудита.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border border-[#111111]/8 bg-white/70 p-3">
                    <p className="text-sm font-medium text-[#111111]">{item.action}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#777777]">{item.username || 'Unknown'} · {format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
                    {item.details ? <p className="mt-1 text-sm text-[#5c5c5c]">{item.details}</p> : null}
                  </div>
                ))}
                {recentActivity.length === 0 && <p className="text-sm text-[#5c5c5c]">Событий пока нет.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="halls" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle>Управление залами</CardTitle>
              <CardDescription>Поиск, сортировка и CRUD-операции по залам.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_220px_180px]">
              <div className="space-y-2">
                <Label htmlFor="hall-query" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="hall-query"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="Название или описание"
                    value={hallQuery}
                    onChange={(event) => setHallQuery(event.target.value)}
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
                      <span className="text-[#5c5c5c]">Цена:</span> <span className="font-medium text-[#111111]">{hall.price_per_hour} ₽/час</span>
                    </div>
                    <div>
                      <span className="text-[#5c5c5c]">Вместимость:</span> <span className="font-medium text-[#111111]">{hall.capacity} чел.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredHalls.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-12 text-center text-[#5c5c5c]">
                По текущему запросу залы не найдены.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111]">Заказы</CardTitle>
              <CardDescription className="text-[#5c5c5c]">Фильтрация и обновление статусов заказов.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label htmlFor="order-search" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="order-search"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="ID, зал, username или email"
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-status" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Статус</Label>
                <Select value={orderStatusFilter} onValueChange={(value) => setOrderStatusFilter(value as 'all' | Order['status'])}>
                  <SelectTrigger id="order-status" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="mono-panel border border-[#111111]/8">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-[#111111]">Заказ #{order.id} · {order.booking.hall.name}</p>
                    <p className="text-sm text-[#5c5c5c]">
                      Клиент: {order.username || '—'} {order.user_email ? `(${order.user_email})` : ''}
                    </p>
                    <p className="text-sm text-[#5c5c5c]">
                      Сумма: {order.total_amount.toLocaleString('ru-RU')} ₽ · Создан: {format(new Date(order.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.28em] text-[#737373]">Изменить статус</Label>
                    <Select
                      value={order.status}
                      onValueChange={(value) => void handleOrderStatusChange(order.id, value as Order['status'])}
                      disabled={updatingOrderId === order.id}
                    >
                      <SelectTrigger className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {orderStatuses.map((statusValue) => (
                          <SelectItem key={statusValue} value={statusValue}>
                            {statusValue}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredOrders.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-12 text-center text-[#5c5c5c]">
                Заказы по текущему фильтру не найдены.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                <Users className="h-5 w-5" />
                Пользователи
              </CardTitle>
              <CardDescription className="text-[#5c5c5c]">Список зарегистрированных пользователей с фильтром по роли.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_220px_160px]">
              <div className="space-y-2">
                <Label htmlFor="user-search" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="user-search"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="Имя, логин или email"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Роль</Label>
                <Select value={userRole} onValueChange={(value) => setUserRole(value as 'all' | 'staff' | 'client')}>
                  <SelectTrigger id="user-role" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="staff">Администраторы</SelectItem>
                    <SelectItem value="client">Клиенты</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" className="h-11 w-full rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee] sm:h-12" onClick={() => void reloadUsers()}>
                  Обновить
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardContent className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Дата регистрации</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium text-[#111111]">{user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#777777]">@{user.username}</p>
                        </TableCell>
                        <TableCell className="text-[#5c5c5c]">{user.email}</TableCell>
                        <TableCell>
                          {user.is_staff ? (
                            <Badge className="rounded-full bg-[#111111] text-white">Admin</Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full bg-white text-[#111111]">
                              Client
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[#5c5c5c]">{user.date_joined ? format(new Date(user.date_joined), 'dd.MM.yyyy', { locale: ru }) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="mt-4 rounded-[1.2rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-10 text-center text-[#5c5c5c]">
                  Пользователи по текущему фильтру не найдены.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                <ShieldCheck className="h-5 w-5" />
                Логи аудита
              </CardTitle>
              <CardDescription className="text-[#5c5c5c]">Полнофункциональный просмотр событий безопасности и действий пользователей.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="log-search" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="log-search"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="Action, username, email, details"
                    value={logSearch}
                    onChange={(event) => setLogSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-action" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Тип</Label>
                <Select value={logAction} onValueChange={setLogAction}>
                  <SelectTrigger id="log-action" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="Booking">Booking</SelectItem>
                    <SelectItem value="User Logged In">User Logged In</SelectItem>
                    <SelectItem value="User Logged Out">User Logged Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="log-from" className="text-xs uppercase tracking-[0.32em] text-[#737373]">От</Label>
                  <DatePickerInput id="log-from" value={logDateFrom} onChange={setLogDateFrom} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="log-to" className="text-xs uppercase tracking-[0.32em] text-[#737373]">До</Label>
                  <DatePickerInput id="log-to" value={logDateTo} onChange={setLogDateTo} />
                </div>
              </div>

              <div className="flex gap-2 lg:col-span-4">
                <Button className="h-11 rounded-full bg-[#111111] px-6 text-white hover:bg-[#2a2a2a] sm:h-12" onClick={() => void applyLogFilters()} disabled={logsLoading}>
                  Применить
                </Button>
                <Button variant="outline" className="h-11 rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee] sm:h-12" onClick={() => void resetLogFilters()} disabled={logsLoading}>
                  Сбросить
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardContent className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Действие</TableHead>
                      <TableHead>Детали</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-[#5c5c5c]">{format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                        <TableCell>
                          <p className="font-medium text-[#111111]">{log.username || 'Anonymous'}</p>
                          <p className="text-xs text-[#777777]">{log.user_email || 'Без email'}</p>
                        </TableCell>
                        <TableCell className="text-[#111111]">{log.action}</TableCell>
                        <TableCell className="max-w-[440px] whitespace-normal text-[#5c5c5c]">{log.details || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {!logsLoading && auditLogs.length === 0 && (
                <div className="mt-4 rounded-[1.2rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-10 text-center text-[#5c5c5c]">
                  События не найдены.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111]">Дополнительные услуги</CardTitle>
              <CardDescription className="text-[#5c5c5c]">
                Локальный CRUD для услуг фронтенда. Эти услуги используются в форме бронирования на странице зала.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label htmlFor="service-search" className="text-xs uppercase tracking-[0.32em] text-[#737373]">
                  Поиск
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                  <Input
                    id="service-search"
                    className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                    placeholder="Название или описание услуги"
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => openServiceDialog()}
                  className="h-11 w-full gap-2 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12"
                >
                  <Plus className="h-4 w-4" />
                  Добавить услугу
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {filteredServices.map((service) => (
              <Card key={service.id} className="mono-panel border border-[#111111]/8">
                <CardContent className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
                  <div>
                    <p className="text-lg font-semibold text-[#111111]">{service.name}</p>
                    <p className="text-sm text-[#5c5c5c]">{service.description || 'Без описания'}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#777777]">
                      {service.pricing_mode === 'hourly'
                        ? `${service.price.toLocaleString('ru-RU')} ₽ / час`
                        : `${service.price.toLocaleString('ru-RU')} ₽ / фикс`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {service.is_active ? (
                      <Badge className="rounded-full bg-[#111111] text-white">Активна</Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-full bg-white text-[#111111]">
                        Выключена
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]"
                      onClick={() => openServiceDialog(service)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]"
                      disabled={deletingServiceId === service.id}
                      onClick={() => void handleServiceDelete(service.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredServices.length === 0 && (
              <div className="rounded-[1.2rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-10 text-center text-[#5c5c5c]">
                Услуги по текущему фильтру не найдены.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="promos" className="space-y-6">
          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
                <TicketPercent className="h-5 w-5" />
                Управление акциями
              </CardTitle>
              <CardDescription className="text-[#5c5c5c]">Создание, активация и деактивация промокодов через PATCH.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <form onSubmit={handleCreatePromo} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="promo-code" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Код</Label>
                  <Input
                    id="promo-code"
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                    value={promoForm.code}
                    onChange={(event) => setPromoForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="SPRING26"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-discount" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Скидка, %</Label>
                  <Input
                    id="promo-discount"
                    type="number"
                    min="1"
                    max="100"
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                    value={promoForm.discount_percent}
                    onChange={(event) => setPromoForm((current) => ({ ...current, discount_percent: Number(event.target.value) }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="promo-description" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Описание</Label>
                  <Input
                    id="promo-description"
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                    value={promoForm.description || ''}
                    onChange={(event) => setPromoForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Скидка на утренние съёмки"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-from" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Действует с</Label>
                  <Input
                    id="promo-from"
                    type="datetime-local"
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                    value={promoForm.valid_from || ''}
                    onChange={(event) => setPromoForm((current) => ({ ...current, valid_from: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-to" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Действует до</Label>
                  <Input
                    id="promo-to"
                    type="datetime-local"
                    className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base"
                    value={promoForm.valid_to || ''}
                    onChange={(event) => setPromoForm((current) => ({ ...current, valid_to: event.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" className="h-11 rounded-full bg-[#111111] px-6 text-white hover:bg-[#2a2a2a] sm:h-12" disabled={creatingPromo}>
                    {creatingPromo ? 'Создание...' : 'Создать промокод'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mono-panel border border-[#111111]/8">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111]">Список промокодов</CardTitle>
              <CardDescription className="text-[#5c5c5c]">Активные коды можно деактивировать без удаления.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                <Input
                  className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                  placeholder="Поиск по коду и описанию"
                  value={promoSearch}
                  onChange={(event) => setPromoSearch(event.target.value)}
                />
              </div>

              <div className="grid gap-3">
                {filteredPromos.map((promo) => (
                  <div key={promo.id} className="flex flex-col gap-3 rounded-[1.3rem] border border-[#111111]/8 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-[#111111]">{promo.code}</p>
                      <p className="text-sm text-[#5c5c5c]">
                        {promo.description || 'Без описания'} · Скидка {promo.discount_percent}%
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#777777]">
                        {promo.valid_to ? `До ${format(new Date(promo.valid_to), 'dd.MM.yyyy HH:mm', { locale: ru })}` : 'Без срока'}
                      </p>
                      <p className="text-xs text-[#777777]">
                        Использований: {promo.uses_count ?? 0}
                        {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {promo.is_active ? (
                        <Badge className="rounded-full bg-[#111111] text-white">Активен</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full bg-white text-[#111111]">
                          Выключен
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]"
                        disabled={updatingPromoId === promo.id}
                        onClick={() => void (promo.is_active ? handleDeactivatePromo(promo.id) : handleActivatePromo(promo.id))}
                      >
                        {updatingPromoId === promo.id ? '...' : promo.is_active ? 'Деактивировать' : 'Активировать'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredPromos.length === 0 && (
                <div className="rounded-[1.2rem] border border-dashed border-[#111111]/12 bg-white/70 px-6 py-10 text-center text-[#5c5c5c]">
                  Промокоды не найдены.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={serviceDialog.open}
        onOpenChange={(open) => setServiceDialog((current) => ({ open, service: open ? current.service : null }))}
      >
        <DialogContent className="max-w-xl border border-[#111111]/10 bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#111111]">
              {serviceDialog.service ? 'Редактировать услугу' : 'Добавить услугу'}
            </DialogTitle>
            <DialogDescription className="text-[#5c5c5c]">
              Настройки применяются к форме бронирования на карточке зала.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleServiceSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Название услуги</Label>
              <Input
                id="service-name"
                value={serviceForm.name}
                onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Визажист"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Описание</Label>
              <Input
                id="service-description"
                value={serviceForm.description || ''}
                onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Короткое описание услуги"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-price">Стоимость</Label>
                <Input
                  id="service-price"
                  type="number"
                  min="0"
                  value={serviceForm.price}
                  onChange={(event) => setServiceForm((current) => ({ ...current, price: Number(event.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-pricing-mode">Тип цены</Label>
                <Select
                  value={serviceForm.pricing_mode}
                  onValueChange={(value) =>
                    setServiceForm((current) => ({ ...current, pricing_mode: value as 'fixed' | 'hourly' }))
                  }
                >
                  <SelectTrigger id="service-pricing-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Фиксированная</SelectItem>
                    <SelectItem value="hourly">Почасовая</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-active" className="text-xs uppercase tracking-[0.22em] text-[#737373]">
                Статус
              </Label>
              <Select
                value={serviceForm.is_active ? 'active' : 'inactive'}
                onValueChange={(value) =>
                  setServiceForm((current) => ({ ...current, is_active: value === 'active' }))
                }
              >
                <SelectTrigger id="service-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активна</SelectItem>
                  <SelectItem value="inactive">Выключена</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]"
                onClick={() => setServiceDialog({ open: false, service: null })}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]"
                disabled={submittingService}
              >
                {submittingService ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={hallDialog.open} onOpenChange={(open) => setHallDialog((current) => ({ open, hall: open ? current.hall : null }))}>
        <DialogContent className="max-w-2xl border border-[#111111]/10 bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#111111]">{hallDialog.hall ? 'Редактировать зал' : 'Добавить зал'}</DialogTitle>
            <DialogDescription className="text-[#5c5c5c]">Поля валидируются до отправки запроса на сервер.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleHallSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hall-name">Название</Label>
              <Input
                id="hall-name"
                value={hallFormData.name}
                onChange={(event) => setHallFormData({ ...hallFormData, name: event.target.value })}
                aria-invalid={!!hallFormErrors.name}
                placeholder="Интерьерный зал"
              />
              {hallFormErrors.name && <p className="text-sm text-rose-600">{hallFormErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hall-price">Цена за час</Label>
                <Input
                  id="hall-price"
                  type="number"
                  min="1"
                  value={hallFormData.price_per_hour}
                  onChange={(event) => setHallFormData({ ...hallFormData, price_per_hour: Number(event.target.value) })}
                  aria-invalid={!!hallFormErrors.price_per_hour}
                />
                {hallFormErrors.price_per_hour && <p className="text-sm text-rose-600">{hallFormErrors.price_per_hour}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hall-capacity">Вместимость</Label>
                <Input
                  id="hall-capacity"
                  type="number"
                  min="1"
                  value={hallFormData.capacity}
                  onChange={(event) => setHallFormData({ ...hallFormData, capacity: Number(event.target.value) })}
                  aria-invalid={!!hallFormErrors.capacity}
                />
                {hallFormErrors.capacity && <p className="text-sm text-rose-600">{hallFormErrors.capacity}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]" onClick={() => setHallDialog({ open: false, hall: null })}>
                Отмена
              </Button>
              <Button type="submit" className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]" disabled={submittingHall}>
                {submittingHall ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((current) => ({ open, hallId: open ? current.hallId : null }))}>
        <AlertDialogContent className="border border-[#111111]/10 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#111111]">Удалить зал?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#5c5c5c]">
              Действие удалит зал из каталога и может повлиять на отчеты.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]">Отмена</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]" onClick={handleDeleteHall} disabled={deletingHall}>
              {deletingHall ? 'Удаляем...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
