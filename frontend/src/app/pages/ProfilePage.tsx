import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mail, Radio, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { getOrders } from '../services/api';
import type { Order } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ProfilePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [wsState, setWsState] = useState<'idle' | 'connecting' | 'connected' | 'unsupported'>('idle');
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string>('Выберите заказ, чтобы открыть realtime-канал статуса.');

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

    const apiBase = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
    const apiUrl = new URL(apiBase);
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${apiUrl.host}/ws/orders/${selectedOrderId}/`;

    let socket: WebSocket | null = null;

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

        if (payload.status) {
          setOrders((current) =>
            current.map((order) => (order.id === selectedOrderId ? { ...order, status: payload.status } : order)),
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
      setWsState((current) => (current === 'connected' ? 'idle' : 'unsupported'));
    };

    return () => {
      socket?.close();
    };
  }, [selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  if (!user) return null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mono-panel rounded-[2rem] border border-[#111111]/8 px-5 py-8 text-center sm:px-8 sm:py-10">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Профиль</p>
        <h1 className="text-4xl text-[#111111] sm:text-5xl">Личный кабинет</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Здесь собраны ваши данные, история заказов и realtime-статус выбранного бронирования.
        </p>
      </section>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#111111]/10 bg-white sm:h-16 sm:w-16">
                <User className="h-7 w-7 text-[#111111] sm:h-8 sm:w-8" />
              </div>
              <div>
                <CardTitle className="text-2xl text-[#111111]">{user.username}</CardTitle>
                <CardDescription className="text-[#5c5c5c]">{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <User className="h-5 w-5 text-[#5c5c5c]" />
                <div className="flex-1">
                  <p className="text-sm text-[#5c5c5c]">Логин</p>
                  <p className="font-medium text-[#111111]">{user.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <Mail className="h-5 w-5 text-[#5c5c5c]" />
                <div className="flex-1">
                  <p className="text-sm text-[#5c5c5c]">Email</p>
                  <p className="font-medium break-all text-[#111111]">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <Shield className="h-5 w-5 text-[#5c5c5c]" />
                <div className="flex-1">
                  <p className="text-sm text-[#5c5c5c]">Роль</p>
                  {user.is_staff ? (
                    <Badge className="rounded-full bg-[#111111] text-white">Администратор</Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full bg-white text-[#111111]">
                      Пользователь
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mono-panel border border-[#111111]/8">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
              <Radio className="h-5 w-5 text-[#111111]" />
              Realtime-статус заказа
            </CardTitle>
            <CardDescription className="text-[#5c5c5c]">
              Подключение к `ws://.../ws/orders/:id/` для обновления статуса в реальном времени.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
              <p className="text-sm text-[#5c5c5c]">Состояние канала</p>
              <p className="mt-1 text-lg font-semibold text-[#111111]">
                {wsState === 'connected' && 'Подключено'}
                {wsState === 'connecting' && 'Подключаемся'}
                {wsState === 'idle' && 'Ожидание'}
                {wsState === 'unsupported' && 'Недоступно'}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4 text-sm leading-7 text-[#4e4e4e]">{lastRealtimeMessage}</div>

            {selectedOrder && (
              <div className="rounded-[1.35rem] border border-[#111111]/8 bg-white/70 p-4">
                <p className="text-sm text-[#5c5c5c]">Отслеживаем заказ</p>
                <p className="mt-1 font-semibold text-[#111111]">#{selectedOrder.id} · {selectedOrder.booking.hall.name}</p>
                <p className="mt-1 text-sm text-[#5c5c5c]">Текущий статус: {selectedOrder.status}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
            <CalendarClock className="h-5 w-5 text-[#111111]" />
            История бронирований
          </CardTitle>
          <CardDescription className="text-[#5c5c5c]">Клиент видит свои заказы и может выбрать любой для realtime-наблюдения.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-[#111111]/8 bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-[#111111]">{order.booking.hall.name}</p>
                <p className="text-sm text-[#5c5c5c]">
                  Заказ #{order.id} · {new Date(order.booking.start_time).toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Badge
                  variant={order.status === 'COMPLETED' ? 'default' : 'secondary'}
                  className={order.status === 'COMPLETED' ? 'rounded-full bg-[#111111] text-white' : 'rounded-full bg-white text-[#111111]'}
                >
                  {order.status}
                </Badge>
                <Button variant="outline" className="rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee]" onClick={() => setSelectedOrderId(order.id)}>
                  Отслеживать
                </Button>
              </div>
            </div>
          ))}

          {orders.length === 0 && <p className="text-sm text-[#5c5c5c]">История заказов пока пуста.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
