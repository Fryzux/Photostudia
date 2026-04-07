import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <Card className="border-[#dbc4a1] bg-[#f5ebdf]">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ead9c2] text-[#8b6d4b]">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="text-3xl">Доступ ограничен</CardTitle>
          <CardDescription>
            Эта часть системы доступна только пользователям с расширенными правами.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Link to="/">
            <Button>Вернуться на главную</Button>
          </Link>
          <Link to="/halls">
            <Button variant="outline">Перейти к бронированию</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
