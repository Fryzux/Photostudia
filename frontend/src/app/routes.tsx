import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { HallsPage } from './pages/HallsPage';
import { HallDetailPage } from './pages/HallDetailPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { AiInsightsPage } from './pages/AiInsightsPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading && isAuthenticated) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Проверяем доступ...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading && isAdmin) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Проверяем права доступа...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Загружаем сессию...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminLegacyRedirect({ tab }: { tab: 'logs' | 'schedule' }) {
  const location = useLocation();
  const current = new URLSearchParams(location.search);
  current.set('tab', tab);
  return <Navigate to={`/admin-panel?${current.toString()}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'portfolio',
        element: <PortfolioPage />,
      },
      {
        path: 'booking',
        element: <HallsPage />,
      },
      {
        path: 'halls',
        element: <HallsPage />,
      },
      {
        path: 'booking/:id',
        element: <HallDetailPage />,
      },
      {
        path: 'halls/:id',
        element: <HallDetailPage />,
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile/bookings',
        element: (
          <ProtectedRoute>
            <MyBookingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-bookings',
        element: <Navigate to="/profile/bookings" replace />,
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'ai-insights',
        element: (
          <ProtectedRoute>
            <AiInsightsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        ),
      },
      {
        path: 'admin-panel',
        element: (
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <AdminRoute>
            <AdminLegacyRedirect tab="logs" />
          </AdminRoute>
        ),
      },
      {
        path: 'manager/schedule',
        element: (
          <AdminRoute>
            <AdminLegacyRedirect tab="schedule" />
          </AdminRoute>
        ),
      },
      {
        path: 'manager-schedule',
        element: (
          <AdminRoute>
            <AdminLegacyRedirect tab="schedule" />
          </AdminRoute>
        ),
      },
      {
        path: 'forbidden',
        element: <ForbiddenPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
