import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CalendarCheck, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { Hall } from '../types';
import { getHalls } from '../services/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';

export function HallsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);

  const query = searchParams.get('q') ?? '';
  const minCapacity = searchParams.get('capacity') ?? '';
  const maxPrice = searchParams.get('price') ?? '';
  const sort = searchParams.get('sort') ?? 'recommended';

  useEffect(() => {
    const loadHalls = async () => {
      try {
        const data = await getHalls();
        setHalls(data);
      } catch (error) {
        toast.error('Не удалось загрузить залы');
      } finally {
        setLoading(false);
      }
    };

    loadHalls();
  }, []);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (!value || value === 'recommended') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    setSearchParams(next, { replace: true });
  };

  const filteredHalls = halls
    .filter((hall) => {
      const matchesQuery =
        !query ||
        hall.name.toLowerCase().includes(query.toLowerCase()) ||
        hall.description.toLowerCase().includes(query.toLowerCase());
      const matchesCapacity = !minCapacity || hall.capacity >= Number(minCapacity);
      const matchesPrice = !maxPrice || hall.price_per_hour <= Number(maxPrice);

      return matchesQuery && matchesCapacity && matchesPrice;
    })
    .sort((left, right) => {
      if (sort === 'price-asc') return left.price_per_hour - right.price_per_hour;
      if (sort === 'price-desc') return right.price_per_hour - left.price_per_hour;
      if (sort === 'capacity-desc') return right.capacity - left.capacity;
      return left.name.localeCompare(right.name, 'ru');
    });

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="mb-2 h-10 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full rounded-t-lg" />
              <CardHeader>
                <Skeleton className="mb-2 h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="mono-panel overflow-hidden rounded-[2rem] border border-[#111111]/8 px-5 py-9 text-center sm:rounded-[2.2rem] sm:px-8 sm:py-12">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Каталог залов</p>
        <h1 className="mb-3 text-4xl text-[#111111] sm:text-6xl">Выберите пространство под свой кадр</h1>
        <p className="mx-auto max-w-2xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          На этой странице собраны все доступные пространства студии. Используйте поиск и фильтры, чтобы быстро найти
          подходящее помещение по цене, вместимости и описанию.
        </p>
      </div>

      <Card className="mono-panel border border-[#111111]/8">
        <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="text-center text-2xl text-[#111111] sm:text-3xl">Поиск и фильтрация</CardTitle>
          <CardDescription className="text-center text-base text-[#5c5c5c]">
            Подберите зал по названию, вместимости и стоимости. Все фильтры сохраняются в адресной строке.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="hall-search" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
              Поиск
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
              <Input
                id="hall-search"
                className="h-11 rounded-full border-[#111111]/12 bg-white pl-10 text-center text-sm sm:h-12 sm:text-base"
                placeholder="Название или описание зала"
                value={query}
                onChange={(e) => updateParam('q', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hall-capacity" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
              Вместимость
            </Label>
            <Input
              id="hall-capacity"
              type="number"
              min="1"
              placeholder="Например, 4"
              value={minCapacity}
              onChange={(e) => updateParam('capacity', e.target.value)}
              className="h-11 rounded-full border-[#111111]/12 bg-white text-center text-sm sm:h-12 sm:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hall-price" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
              Цена
            </Label>
            <Input
              id="hall-price"
              type="number"
              min="0"
              placeholder="Например, 5000"
              value={maxPrice}
              onChange={(e) => updateParam('price', e.target.value)}
              className="h-11 rounded-full border-[#111111]/12 bg-white text-center text-sm sm:h-12 sm:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hall-sort" className="block text-center text-xs uppercase tracking-[0.32em] text-[#737373]">
              Сортировка
            </Label>
            <Select value={sort} onValueChange={(value) => updateParam('sort', value)}>
              <SelectTrigger id="hall-sort" className="h-11 rounded-full border-[#111111]/12 bg-white text-sm sm:h-12 sm:text-base">
                <SelectValue placeholder="По умолчанию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">По умолчанию</SelectItem>
                <SelectItem value="price-asc">Сначала дешевле</SelectItem>
                <SelectItem value="price-desc">Сначала дороже</SelectItem>
                <SelectItem value="capacity-desc">По вместимости</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="h-11 w-full rounded-full border-[#111111]/12 bg-white text-[#111111] hover:bg-[#f1f1ee] sm:h-12"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-[#737373]">Найдено залов: {filteredHalls.length}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredHalls.map((hall) => (
          <Card key={hall.id} className="mono-panel lift-card overflow-hidden rounded-[1.8rem] border border-[#111111]/8 text-center">
            <div className="relative h-48 bg-gray-200 sm:h-56">
              {hall.images[0] && <img src={hall.images[0]} alt={hall.name} className="grayscale-photo h-full w-full object-cover" />}
              <div className="absolute right-3 top-3">
                <Badge className="rounded-full bg-white px-3 py-1 text-xs text-[#111111] shadow-sm sm:text-sm">{hall.price_per_hour} ₽/час</Badge>
              </div>
            </div>

            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle className="text-2xl text-[#111111] sm:text-3xl">{hall.name}</CardTitle>
              <CardDescription className="line-clamp-3 text-sm leading-7 text-[#5c5c5c] sm:text-base">{hall.description}</CardDescription>
            </CardHeader>

            <CardContent className="px-5 sm:px-6">
              <div className="flex items-center justify-center gap-4 text-sm text-[#5c5c5c]">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>До {hall.capacity} чел.</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="px-5 pb-5 sm:px-6 sm:pb-6">
              <Link to={`/halls/${hall.id}`} className="w-full">
                <Button className="h-11 w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] sm:h-12">
                  <CalendarCheck className="h-4 w-4" />
                  Забронировать
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredHalls.length === 0 && (
        <div className="mono-panel rounded-[2rem] border border-dashed border-[#111111]/12 px-5 py-12 text-center sm:px-6 sm:py-14">
          <p className="text-xl text-[#111111]">По выбранным фильтрам залы не найдены.</p>
          <p className="mt-2 text-base text-[#5c5c5c]">Попробуйте изменить цену, вместимость или текст запроса.</p>
        </div>
      )}
    </div>
  );
}
