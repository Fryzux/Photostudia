import type { MouseEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { Instagram, LogOut, Mail, MapPin, Menu, Moon, Phone, Sun, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from 'next-themes';

import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { contacts } from '../data/studio';

const homeSectionItems = [
  { label: 'Залы', to: '/#home-halls', section: 'home-halls' },
  { label: 'Бронирование', to: '/#home-booking', section: 'home-booking' },
  { label: 'Портфолио', to: '/#home-portfolio', section: 'home-portfolio' },
];

const HEADER_SCROLL_ENTER = 56;
const HEADER_SCROLL_EXIT = 16;

function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={`h-9 w-9 ${className}`} />;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Переключить тему"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={`h-9 w-9 rounded-full border border-border p-0 text-foreground hover:bg-accent ${className}`}
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Layout() {
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('about');
  const mainRef = useRef<HTMLElement | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname !== '/') return;
    event.preventDefault();
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const sectionIds = [...homeSectionItems.map((item) => item.section), 'contacts'];
    let rafId = 0;

    const updateHeaderState = () => {
      const y = window.scrollY;
      setIsScrolled((current) => {
        if (current) return y > HEADER_SCROLL_EXIT;
        return y > HEADER_SCROLL_ENTER;
      });

      if (location.pathname === '/') {
        let currentSection = 'about';
        for (const sectionId of sectionIds) {
          const element = document.getElementById(sectionId);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (rect.top <= 140) currentSection = sectionId;
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

  useEffect(() => {
    const mainElement = mainRef.current;
    if (!mainElement) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canObserve = 'IntersectionObserver' in window && !prefersReducedMotion;
    const observedTargets = new Set<HTMLElement>();

    const revealTarget = (target: HTMLElement) => {
      if (!target.classList.contains('reveal-section')) target.classList.add('reveal-section');
      target.classList.add('is-revealed');
    };

    const observer = canObserve
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target as HTMLElement;
              revealTarget(target);
              observer.unobserve(target);
            });
          },
          { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
        )
      : null;

    const observeTargets = () => {
      const targets = Array.from(mainElement.querySelectorAll<HTMLElement>('[data-reveal="section"]'));
      targets.forEach((target) => {
        if (!target.classList.contains('reveal-section')) target.classList.add('reveal-section');
        if (observedTargets.has(target)) return;
        observedTargets.add(target);
        if (!observer) { revealTarget(target); return; }
        observer.observe(target);
      });
    };

    observeTargets();
    const rafId = window.requestAnimationFrame(observeTargets);
    const mutationObserver = new MutationObserver(observeTargets);
    mutationObserver.observe(mainElement, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [location.pathname, location.search]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const pageItems = [
    { label: 'Каталог', to: '/halls', active: isActive('/halls') || isActive('/booking') },
    ...(isAuthenticated ? [{ label: 'AI', to: '/ai-insights', active: isActive('/ai-insights') }] : []),
    ...(isAdmin ? [{ label: 'Админ', to: '/admin-panel', active: isActive('/admin') || isActive('/admin-panel') }] : []),
  ];

  const navItemClass = (active: boolean) =>
    [
      'relative whitespace-nowrap text-[0.9rem] uppercase tracking-[0.1em] transition-colors xl:text-[0.95rem] xl:tracking-[0.12em]',
      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      'after:absolute after:-bottom-2 after:left-0 after:h-px after:bg-foreground after:transition-all',
      active ? 'after:w-full' : 'after:w-0 hover:after:w-full',
    ].join(' ');

  const NavigationLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {homeSectionItems.map((item) =>
        mobile ? (
          <Link key={item.section} to={item.to} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-foreground">
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
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-foreground">
              {item.label}
            </Button>
          </Link>
        ) : (
          <Link key={item.to} to={item.to} className={navItemClass(item.active)}>
            {item.label}
          </Link>
        ),
      )}

      {mobile ? (
        <Link to="/#contacts" onClick={() => setMobileMenuOpen(false)}>
          <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-foreground">
            Контакты
          </Button>
        </Link>
      ) : (
        <Link key="contacts" to="/#contacts" className={navItemClass(location.pathname === '/' && activeSection === 'contacts')}>
          Контакты
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur transition-all duration-300 ${
          isScrolled
            ? 'border-border bg-card/95 shadow-[0_10px_30px_rgba(17,17,17,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
            : 'border-border bg-card/88'
        }`}
      >
        <div className="mx-auto w-full px-4 py-2 sm:px-6 sm:py-3 lg:px-10">
          {/* Desktop */}
          <div className="hidden h-20 min-w-0 items-center justify-between gap-4 xl:flex">
            <Link to="/#about" onClick={handleBrandClick} className="shrink-0 text-foreground">
              <p className={`font-display origin-left text-5xl leading-none transition-transform duration-300 will-change-transform ${isScrolled ? 'scale-[0.88]' : 'scale-100'}`}>
                Экспозиция
              </p>
            </Link>

            <nav className={`flex flex-1 items-center justify-center gap-4 transition-transform duration-300 2xl:gap-7 ${isScrolled ? 'translate-y-[-1px]' : 'translate-y-0'}`}>
              <NavigationLinks />
            </nav>

            <div className={`flex shrink-0 items-center gap-3 transition-transform duration-300 ${isScrolled ? 'translate-y-[-1px]' : 'translate-y-0'}`}>
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  <Link to="/profile">
                    <Button variant="outline" size="sm" className="rounded-full border-border bg-card text-foreground">
                      <User className="mr-2 h-4 w-4" />
                      {user?.first_name || user?.username}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => void handleLogout()} className="rounded-full text-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button size="sm" className="rounded-full border border-foreground bg-transparent px-5 text-foreground hover:bg-foreground hover:text-background">
                    Войти
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile */}
          <div className="flex h-14 items-center justify-between sm:h-16 xl:hidden">
            <Link to="/#about" onClick={handleBrandClick} className="text-foreground">
              <p className={`font-display origin-left text-[2.35rem] leading-none transition-transform duration-300 will-change-transform sm:text-4xl ${isScrolled ? 'scale-[0.93]' : 'scale-100'}`}>
                Экспозиция
              </p>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 rounded-full border border-border px-4">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-l border-border bg-card">
                  <SheetTitle className="sr-only">Меню</SheetTitle>
                  <div className="mt-6 flex flex-col gap-4">
                    {isAuthenticated ? (
                      <div className="border-b border-border pb-4 text-center">
                        <p className="font-medium text-foreground">{user?.first_name || user?.username}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    ) : null}

                    <NavigationLinks mobile />

                    {isAuthenticated ? (
                      <>
                        <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-foreground">
                            <User className="mr-2 h-4 w-4" />
                            Профиль
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { void handleLogout(); setMobileMenuOpen(false); }}
                          className="w-full justify-start rounded-full text-foreground"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Выйти
                        </Button>
                      </>
                    ) : (
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90">Войти</Button>
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-border bg-secondary/50 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <div className="space-y-4">
              <Link to="/" className="text-foreground">
                <p className="font-display text-4xl leading-none">Экспозиция</p>
              </Link>
              <p className="text-sm leading-6 text-muted-foreground">
                Пространство для творчества, где свет и тень создают искусство.
                Чёрно-белый минимализм и современное оборудование для ваших идей.
              </p>
              <div className="flex gap-4 pt-2">
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-foreground hover:text-background">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-foreground hover:text-background">
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground">Навигация</h4>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
                {homeSectionItems.map(item => (
                  <li key={item.section}>
                    <Link to={item.to} className="text-sm text-muted-foreground transition hover:text-foreground">
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/halls" className="text-sm text-muted-foreground transition hover:text-foreground">
                    Каталог залов
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground">Контакты</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-foreground" />
                  <span>{contacts.address}</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0 text-foreground" />
                  <span>{contacts.phone}</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-foreground" />
                  <span>hello@exposition.studio</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 border-t border-border pt-8">
            <p className="text-center text-xs leading-6 text-muted-foreground">
              © 2026 Студия Экспозиция · Эстетика в каждом кадре
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
