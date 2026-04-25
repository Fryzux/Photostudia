import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { CalendarClock, Mail, Radio, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { getOrders } from '../services/api';
import type { Order, OrderStatus } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ProfilePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [wsState, setWsState] = useState<'idle' | 'connecting' | 'connected' | 'unsupported'>('idle');
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string>('Выберите заказ, чтобы открыть realtime-канал статуса.');
  const [wsRetryTick, setWsRetryTick] = useState(0);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await getOrders();
        setOrders(data);
        if (data[0]) {
          setSelectedOrderId(data[0].id);
        }
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить историю заказов.');
      }
    };

    loadOrders();
  }, []);

  useEffect(() => {
    if (!selectedOrderId) return;

    const apiBase = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const apiUrl = new URL(apiBase);
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${apiUrl.host}/ws/orders/${selectedOrderId}/`;

    let socket: WebSocket | null = null;
    let closedByCleanup = false;

    try {
      setWsState('connecting');
      socket = new WebSocket(socketUrl);
    } catch {
      setWsState('unsupported');
      setLastRealtimeMessage('Realtime-канал недоступен в текущем окружении.');
      return;
    }

    socket.onopen = () => {
      setWsState('connected');
      setLastRealtimeMessage('Соединение установлено. Ожидаем обновления статуса заказа.');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nextStatus = payload.status || payload.order_status || payload.type || 'status_update';
        setLastRealtimeMessage(`Получено событие realtime: ${nextStatus}.`);

        const validStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
        if (payload.status && validStatuses.includes(payload.status as OrderStatus)) {
          setOrders((current) =>
            current.map((order) =>
              order.id === selectedOrderId ? { ...order, status: payload.status as OrderStatus } : order,
            ),
          );
        }
      } catch {
        setLastRealtimeMessage('Получено событие realtime, но его формат не удалось распознать.');
      }
    };

    socket.onerror = () => {
      setWsState('unsupported');
      setLastRealtimeMessage('WebSocket endpoint еще не подключен на сервере. История заказов продолжает работать через REST API.');
    };

    socket.onclose = () => {
      if (closedByCleanup) return;
      setWsState('unsupported');
      setLastRealtimeMessage('Соединение прервано. Можно переподключиться кнопкой ниже.');
    };

    return () => {
      closedByCleanup = true;
      socket?.close();
    };
  }, [selectedOrderId, wsRetryTick]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section data-reveal="section" className="reveal-section mono-panel rounded-[2rem] border border-border px-5 py-8 text-center sm:px-8 sm:py-10">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-muted-foreground">Профиль</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Личный кабинет</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
          Здесь собраны ваши данные, история заказов и realtime-статус выбранного бронирования.
        </p>
        <div className="mt-6">
          <Link to="/profile/bookings">
            <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">Открыть мои бронирования</Button>
          </Link>
        </div>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card data-reveal="section" className="reveal-section mono-panel border border-border">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card sm:h-16 sm:w-16">
                <User className="h-7 w-7 text-foreground sm:h-8 sm:w-8" />
              </div>
              <div>
                <CardTitle className="text-2xl text-foreground">{user.username}</CardTitle>
                <CardDescription className="text-muted-foreground">{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-border bg-card/70 p-4">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Логин</p>
                  <p className="font-medium text-foreground">{user.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[1.35rem] border border-border bg-card/70 p-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium break-all text-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[1.35rem] border border-border bg-card/70 p-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Роль</p>
                  <div className="flex gap-2">
                    {user.is_staff && <Badge className="rounded-full bg-foreground text-background">Администратор</Badge>}
                    {user.is_manager && <Badge className="rounded-full bg-amber-500 text-white hover:bg-amber-600">Менеджер</Badge>}
                    {!user.is_staff && !user.is_manager && (
                      <Badge variant="secondary" className="rounded-full bg-card text-foreground">
                        Пользователь
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-reveal="section" className="reveal-section mono-panel border border-border">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
              <Radio className="h-5 w-5 text-foreground" />
              Realtime-статус заказа
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Подключение к `ws://.../ws/orders/:id/` для обновления статуса в реальном времени.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
              <p className="text-sm text-muted-foreground">Состояние канала</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {wsState === 'connected' && 'Подключено'}
                {wsState === 'connecting' && 'Подключаемся'}
                {wsState === 'idle' && 'Ожидание'}
                {wsState === 'unsupported' && 'Недоступно'}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-border bg-card/70 p-4 text-sm leading-7 text-[#4e4e4e]">{lastRealtimeMessage}</div>

            {wsState === 'unsupported' && (
              <Button
                variant="outline"
                className="rounded-full border-border bg-card text-foreground hover:bg-accent"
                onClick={() => setWsRetryTick((value) => value + 1)}
              >
                Повторить подключение
              </Button>
            )}

            {selectedOrder && (
              <div className="rounded-[1.35rem] border border-border bg-card/70 p-4">
                <p className="text-sm text-muted-foreground">Отслеживаем заказ</p>
                <p className="mt-1 font-semibold text-foreground">#{selectedOrder.id} · {selectedOrder.booking.hall.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">Текущий статус: {selectedOrder.status}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-reveal="section" className="reveal-section mono-panel border border-border">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <CalendarClock className="h-5 w-5 text-foreground" />
            История бронирований
          </CardTitle>
          <CardDescription className="text-muted-foreground">Клиент видит свои заказы и может выбрать любой для realtime-наблюдения.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-border bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-foreground">{order.booking.hall.name}</p>
                <p className="text-sm text-muted-foreground">
                  Заказ #{order.id} · {new Date(order.booking.start_time).toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Badge
                  variant={order.status === 'COMPLETED' ? 'default' : 'secondary'}
                  className={order.status === 'COMPLETED' ? 'rounded-full bg-foreground text-background' : 'rounded-full bg-card text-foreground'}
                >
                  {order.status}
                </Badge>
                <Button variant="outline" className="rounded-full border-border bg-card text-foreground hover:bg-accent" onClick={() => setSelectedOrderId(order.id)}>
                  Отслеживать
                </Button>
              </div>
            </div>
          ))}

          {orders.length === 0 && <p className="text-sm text-muted-foreground">История заказов пока пуста.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
