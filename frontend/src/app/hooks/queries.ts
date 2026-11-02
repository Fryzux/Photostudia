import { QueryClient, useQuery } from '@tanstack/react-query';

import { getHall, getHallAvailability, getHalls, getStudioServices, getWeeklyForecast } from '../services/api';

// Каталог (залы, услуги) меняется редко — считаем его свежим 5 минут и не
// перезапрашиваем при каждом переходе между страницами.
const CATALOG_STALE_MS = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  halls: ['halls'] as const,
  hall: (id: number) => ['halls', id] as const,
  availability: (hallId: number, date: string) => ['availability', hallId, date] as const,
  services: ['services'] as const,
  weeklyForecast: (hallId: number) => ['ai', 'weekly', hallId] as const,
};

export function useHalls() {
  return useQuery({ queryKey: queryKeys.halls, queryFn: getHalls, staleTime: CATALOG_STALE_MS });
}

export function useHall(id: number | null) {
  return useQuery({
    queryKey: queryKeys.hall(id ?? 0),
    queryFn: () => getHall(id as number),
    enabled: !!id,
    staleTime: CATALOG_STALE_MS,
    // Пока грузится карточка, показываем зал из уже загруженного списка
    initialData: () => queryClient.getQueryData<Awaited<ReturnType<typeof getHalls>>>(queryKeys.halls)
      ?.find((hall) => hall.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.halls)?.dataUpdatedAt,
  });
}

export function useStudioServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: getStudioServices, staleTime: CATALOG_STALE_MS });
}

export function useHallAvailability(hallId: number | null, date: string) {
  return useQuery({
    queryKey: queryKeys.availability(hallId ?? 0, date),
    queryFn: () => getHallAvailability(hallId as number, date),
    enabled: !!hallId && !!date,
    staleTime: 10 * 1000,
    // Слоты могут занять другие клиенты — опрашиваем, пока страница открыта
    refetchInterval: 15 * 1000,
  });
}

export function useWeeklyForecast(hallId: number | null) {
  return useQuery({
    queryKey: queryKeys.weeklyForecast(hallId ?? 0),
    queryFn: () => getWeeklyForecast(hallId as number),
    enabled: !!hallId,
    staleTime: 10 * 60 * 1000,
  });
}
