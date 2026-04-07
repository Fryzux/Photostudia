import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f6efe6_0%,#fbf6ef_45%,#fffaf4_100%)] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-3xl font-bold mb-4">Страница не найдена</h2>
        <p className="text-gray-600 mb-8">
          К сожалению, запрашиваемая страница не существует
        </p>
        <Link to="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
