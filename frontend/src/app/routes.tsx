import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { tokenStorage } from './services/api';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const HallsPage = lazy(() => import('./pages/HallsPage').then(m => ({ default: m.HallsPage })));
const HallDetailPage = lazy(() => import('./pages/HallDetailPage').then(m => ({ default: m.HallDetailPage })));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage').then(m => ({ default: m.MyBookingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const AiInsightsPage = lazy(() => import('./pages/AiInsightsPage').then(m => ({ default: m.AiInsightsPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage').then(m => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ManagerPage = lazy(() => import('./pages/ManagerPage').then(m => ({ default: m.ManagerPage })));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#111111]/10 border-t-[#111111]" />
    </div>
  );
}

// Есть ли у пользователя сохранённая сессия (refresh token в sessionStorage)?
const hasSession = () => !!tokenStorage.getRefreshToken();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  // Пока идёт проверка — если есть сессия, показываем контент оптимистично
  if (loading) {
    return hasSession() ? <>{children}</> : <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, loading } = useAuth();

  if (loading) {
    // Уже знаем роль — показываем сразу; иначе тихо ждём (спиннер, не текст)
    if (isAdmin) return <>{children}</>;
    return hasSession() ? <PageLoader /> : <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

function ManagerRoute({ children }: { children: ReactNode }) {
  const { isManager, isAuthenticated, loading } = useAuth();

  if (loading) {
    if (isManager) return <>{children}</>;
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isManager) {
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
    element: (
      <Suspense fallback={<PageLoader />}>
        <Layout />
      </Suspense>
    ),
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
        path: 'manager',
        element: (
          <ManagerRoute>
            <ManagerPage />
          </ManagerRoute>
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
