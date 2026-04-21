import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { LogOut, Menu, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

const homeSectionItems = [
  { label: 'О студии', to: '/#about', section: 'about' },
  { label: 'Залы', to: '/#home-halls', section: 'home-halls' },
  { label: 'Бронирование', to: '/#home-booking', section: 'home-booking' },
  { label: 'Портфолио', to: '/#home-portfolio', section: 'home-portfolio' },
  { label: 'Контакты', to: '/#contacts', section: 'contacts' },
];

const HEADER_SCROLL_ENTER = 56;
const HEADER_SCROLL_EXIT = 16;

export function Layout() {
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('about');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const sectionIds = homeSectionItems.map((item) => item.section);

    let rafId = 0;

    const updateHeaderState = () => {
      const y = window.scrollY;
      setIsScrolled((current) => {
        if (current) {
          return y > HEADER_SCROLL_EXIT;
        }
        return y > HEADER_SCROLL_ENTER;
      });

      if (location.pathname === '/') {
        let currentSection = 'about';
        for (const sectionId of sectionIds) {
          const element = document.getElementById(sectionId);
          if (!element) continue;

          const rect = element.getBoundingClientRect();
          if (rect.top <= 140) {
            currentSection = sectionId;
          }
        }

        setActiveSection((current) => (current === currentSection ? current : currentSection));
      }
      rafId = 0;
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateHeaderState);
    };

    updateHeaderState();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [location.pathname]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const pageItems = [
    { label: 'Каталог', to: '/halls', active: isActive('/halls') || isActive('/booking') },
    ...(isAuthenticated ? [{ label: 'Брони', to: '/my-bookings', active: isActive('/my-bookings') }] : []),
    ...(isAuthenticated ? [{ label: 'AI', to: '/ai-insights', active: isActive('/ai-insights') }] : []),
    ...(isAdmin ? [{ label: 'Расписание', to: '/manager/schedule', active: isActive('/manager/schedule') || isActive('/manager-schedule') }] : []),
    ...(isAdmin ? [{ label: 'Админ', to: '/admin-panel', active: isActive('/admin') || isActive('/admin-panel') }] : []),
    ...(isAdmin ? [{ label: 'Аудит', to: '/admin/audit', active: isActive('/admin/audit') }] : []),
  ];

  const navItemClass = (active: boolean) =>
    [
      'relative text-[0.95rem] uppercase tracking-[0.12em] transition-colors',
      active ? 'text-[#111111]' : 'text-[#434343] hover:text-[#111111]',
      "after:absolute after:-bottom-2 after:left-0 after:h-px after:bg-[#111111] after:transition-all",
      active ? 'after:w-full' : 'after:w-0 hover:after:w-full',
    ].join(' ');

  const NavigationLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {homeSectionItems.map((item) =>
        mobile ? (
          <Link key={item.section} to={item.to} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-[#111111]">
              {item.label}
            </Button>
          </Link>
        ) : (
          <Link key={item.section} to={item.to} className={navItemClass(location.pathname === '/' && activeSection === item.section)}>
            {item.label}
          </Link>
        ),
      )}

      {pageItems.map((item) =>
        mobile ? (
          <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-[#111111]">
              {item.label}
            </Button>
          </Link>
        ) : (
          <Link key={item.to} to={item.to} className={navItemClass(item.active)}>
            {item.label}
          </Link>
        ),
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf8_0%,#f3f3f0_100%)]">
      <header
        className={`sticky top-0 z-40 border-b border-[#111111]/8 bg-white/90 backdrop-blur transition-shadow duration-300 ${
          isScrolled ? 'shadow-[0_10px_30px_rgba(17,17,17,0.05)]' : ''
        }`}
      >
        <div
          className={`mx-auto w-full px-4 transition-[padding] duration-300 sm:px-6 lg:px-10 ${isScrolled ? 'py-3' : 'py-4 sm:py-5'}`}
        >
          <div className="hidden min-w-0 items-center justify-between gap-4 md:flex">
            <Link to="/" className="shrink-0 text-[#111111]">
              <p className={`font-display leading-none transition-all duration-300 ${isScrolled ? 'text-4xl' : 'text-5xl'}`}>Экспозиция</p>
            </Link>

            <nav className="flex flex-1 items-center justify-center gap-6 lg:gap-8">
              <NavigationLinks />
            </nav>

            <div className="flex shrink-0 items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link to="/profile">
                    <Button variant="outline" size="sm" className="rounded-full border-[#111111]/12 bg-white text-[#111111]">
                      <User className="mr-2 h-4 w-4" />
                      {user?.first_name || user?.username}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => void handleLogout()} className="rounded-full text-[#111111]">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button size="sm" className="rounded-full border border-[#111111] bg-transparent px-5 text-[#111111] hover:bg-[#111111] hover:text-white">
                    Войти
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between md:hidden">
            <Link to="/" className="text-[#111111]">
              <p className="font-display text-[2.35rem] leading-none sm:text-4xl">Экспозиция</p>
            </Link>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 rounded-full border border-[#111111]/10 px-4">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="border-l border-[#111111]/10 bg-white">
                <div className="mt-6 flex flex-col gap-4">
                  {isAuthenticated ? (
                    <div className="border-b border-[#111111]/10 pb-4 text-center">
                      <p className="font-medium text-[#111111]">{user?.first_name || user?.username}</p>
                      <p className="text-sm text-[#6a6a6a]">{user?.email}</p>
                    </div>
                  ) : null}

                  <NavigationLinks mobile />

                  {isAuthenticated ? (
                    <>
                      <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" size="sm" className="w-full justify-start rounded-full">
                          <User className="mr-2 h-4 w-4" />
                          Профиль
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full justify-start rounded-full"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Выйти
                      </Button>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">Войти</Button>
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <Outlet />
      </main>

      <footer className="border-t border-[#111111]/8 bg-white/82">
        <div className="mx-auto w-full px-4 py-5 text-center sm:px-6 lg:px-10">
          <p className="text-sm leading-6 text-[#5f5f5f]">© 2026 Фотостудия "Экспозиция". Чёрно-белый минимализм для бронирования и съёмок.</p>
        </div>
      </footer>
    </div>
  );
}
