import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ClipboardList, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';

import type { AuditLog } from '../types';
import { getActionLogsPage } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePickerInput } from '../components/ui/date-picker-input';
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
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  const search = searchParams.get('search') ?? '';
  const action = searchParams.get('action') ?? 'all';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const [debouncedFilters, setDebouncedFilters] = useState(() => ({
    search,
    action,
    dateFrom,
    dateTo,
    page,
  }));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFilters({
        search,
        action,
        dateFrom,
        dateTo,
        page,
      });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [action, dateFrom, dateTo, page, search]);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const response = await getActionLogsPage({
          search: debouncedFilters.search,
          action: debouncedFilters.action,
          date_from: debouncedFilters.dateFrom,
          date_to: debouncedFilters.dateTo,
          page: debouncedFilters.page,
        });
        setLogs(response.results);
        setTotalCount(response.count);
        setHasNextPage(Boolean(response.next));
        setHasPrevPage(Boolean(response.previous));
      } catch (error: any) {
        toast.error(error.message || 'Не удалось загрузить журнал действий.');
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, [debouncedFilters]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    if (key !== 'page') {
      next.delete('page');
    }
    setSearchParams(next, { replace: true });
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(nextPage));
    }
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div data-reveal="section" className="reveal-section mono-panel overflow-hidden rounded-[2rem] border border-border p-5 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-muted-foreground">Аудит и безопасность</p>
        <h1 className="mb-3 text-4xl text-foreground sm:text-5xl">Журнал действий пользователей</h1>
        <p className="max-w-3xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
          Страница помогает подтвердить требования по аудиту, безопасности и разграничению доступа: здесь видны ключевые
          действия пользователей и их временные метки.
        </p>
      </div>

      <Card data-reveal="section" className="reveal-section mono-panel border border-border">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <Filter className="h-5 w-5 text-foreground" />
            Фильтрация журнала
          </CardTitle>
          <CardDescription className="text-muted-foreground">Поиск по пользователю, действию и дате помогает быстро находить нужные события.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="audit-search" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-search"
                className="h-11 rounded-full border-border bg-card pl-9 text-sm sm:h-12 sm:text-base"
                placeholder="Пользователь, email, действие или детали"
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-action" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Тип действия</Label>
            <Select value={action} onValueChange={(value) => updateParam('action', value)}>
              <SelectTrigger id="audit-action" className="h-11 rounded-full border-border bg-card text-sm sm:h-12 sm:text-base">
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
            <Button variant="outline" className="h-11 w-full rounded-full border-border bg-card text-foreground hover:bg-accent sm:h-12" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-from" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Дата от</Label>
            <DatePickerInput id="date-from" value={dateFrom} onChange={(nextDate) => updateParam('date_from', nextDate)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to" className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Дата до</Label>
            <DatePickerInput id="date-to" value={dateTo} onChange={(nextDate) => updateParam('date_to', nextDate)} />
          </div>
        </CardContent>
      </Card>

      <Card data-reveal="section" className="reveal-section mono-panel border border-border">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <ClipboardList className="h-5 w-5 text-foreground" />
            Лента событий
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {loading ? 'Загружаем события...' : `Всего событий: ${totalCount} · Страница ${page}`}
          </CardDescription>
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
            <div className="rounded-[1.5rem] border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
              События по выбранным фильтрам не найдены.
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                className="rounded-full border-border bg-card text-foreground hover:bg-accent"
                disabled={!hasPrevPage}
                onClick={() => goToPage(page - 1)}
              >
                Назад
              </Button>
              <p className="text-sm text-muted-foreground">
                Показано {logs.length} из {totalCount}
              </p>
              <Button
                variant="outline"
                className="rounded-full border-border bg-card text-foreground hover:bg-accent"
                disabled={!hasNextPage}
                onClick={() => goToPage(page + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
