import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ClipboardList, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';

import type { AuditLog } from '../types';
import { getActionLogs } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const actionOptions = [
  { value: 'all', label: 'Все действия' },
  { value: 'Booking Created', label: 'Создание брони' },
  { value: 'Booking Deleted', label: 'Удаление брони' },
  { value: 'User Logged In', label: 'Вход в систему' },
];

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') ?? '';
  const action = searchParams.get('action') ?? 'all';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const data = await getActionLogs({
          search,
          action,
          date_from: dateFrom,
          date_to: dateTo,
        });
        setLogs(data);
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить журнал действий.');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [action, dateFrom, dateTo, search]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Аудит и безопасность</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-5xl">Журнал действий пользователей</h1>
        <p className="max-w-3xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Страница помогает подтвердить требования по аудиту, безопасности и разграничению доступа: здесь видны ключевые
          действия пользователей и их временные метки.
        </p>
      </div>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
            <Filter className="h-5 w-5 text-[#111111]" />
            Фильтрация журнала
          </CardTitle>
          <CardDescription className="text-[#5c5c5c]">Поиск по пользователю, действию и дате помогает быстро находить нужные события.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="audit-search" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
              <Input
                id="audit-search"
                className="h-11 rounded-full border-[#111111]/12 bg-white pl-9 text-sm sm:h-12 sm:text-base"
                placeholder="Пользователь, email, действие или детали"
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-action" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Тип действия</Label>
            <Select value={action} onValueChange={(value) => updateParam('action', value)}>
              <SelectTrigger id="audit-action" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                <SelectValue placeholder="Все действия" />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="h-11 w-full rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee] sm:h-12" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-from" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Дата от</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(e) => updateParam('date_from', e.target.value)} className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to" className="text-xs uppercase tracking-[0.32em] text-[#737373]">Дата до</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(e) => updateParam('date_to', e.target.value)} className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base" />
          </div>
        </CardContent>
      </Card>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-[#111111]">
            <ClipboardList className="h-5 w-5 text-[#111111]" />
            Лента событий
          </CardTitle>
          <CardDescription className="text-[#5c5c5c]">{loading ? 'Загружаем события...' : `Найдено событий: ${logs.length}`}</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm', { locale: ru })}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{log.username}</div>
                    <div className="text-xs text-slate-500">{log.user_email || 'Без email'}</div>
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal text-slate-600">
                    {log.details || 'Дополнительные детали не переданы'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>

          {!loading && logs.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-[#111111]/12 px-6 py-12 text-center text-[#5c5c5c]">
              События по выбранным фильтрам не найдены.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
