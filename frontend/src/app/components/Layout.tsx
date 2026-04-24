import type { MouseEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

const homeSectionItems = [
  { label: 'Залы', to: '/#home-halls', section: 'home-halls' },
  { label: 'Бронирование', to: '/#home-booking', section: 'home-booking' },
  { label: 'Портфолио', to: '/#home-portfolio', section: 'home-portfolio' },
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

  useEffect(() => {
    const mainElement = mainRef.current;
    if (!mainElement) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canObserve = 'IntersectionObserver' in window && !prefersReducedMotion;
    const observedTargets = new Set<HTMLElement>();

    const revealTarget = (target: HTMLElement) => {
      if (!target.classList.contains('reveal-section')) {
        target.classList.add('reveal-section');
      }
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
          {
            threshold: 0.08,
            rootMargin: '0px 0px -8% 0px',
          },
        )
      : null;

    const observeTargets = () => {
      const targets = Array.from(mainElement.querySelectorAll<HTMLElement>('[data-reveal="section"]'));
      targets.forEach((target) => {
        if (!target.classList.contains('reveal-section')) {
          target.classList.add('reveal-section');
        }
        if (observedTargets.has(target)) return;

        observedTargets.add(target);
        if (!observer) {
          revealTarget(target);
          return;
        }

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

      {mobile ? (
        <Link to="/#contacts" onClick={() => setMobileMenuOpen(false)}>
          <Button variant="ghost" size="sm" className="w-full justify-start rounded-full text-[#111111]">
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf8_0%,#f3f3f0_100%)]">
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur transition-all duration-300 ${
          isScrolled
            ? 'border-[#111111]/12 bg-white/95 shadow-[0_10px_30px_rgba(17,17,17,0.06)]'
            : 'border-[#111111]/8 bg-white/88'
        }`}
      >
        <div className="mx-auto w-full px-4 py-2 sm:px-6 sm:py-3 lg:px-10">
          <div className="hidden h-20 min-w-0 items-center justify-between gap-4 xl:flex">
            <Link to="/#about" onClick={handleBrandClick} className="shrink-0 text-[#111111]">
              <p
                className={`font-display origin-left text-5xl leading-none transition-transform duration-300 will-change-transform ${
                  isScrolled ? 'scale-[0.88]' : 'scale-100'
                }`}
              >
                Экспозиция
              </p>
            </Link>

            <nav
              className={`flex flex-1 items-center justify-center gap-4 transition-transform duration-300 2xl:gap-7 ${
                isScrolled ? 'translate-y-[-1px]' : 'translate-y-0'
              }`}
            >
              <NavigationLinks />
            </nav>

            <div
              className={`flex shrink-0 items-center gap-3 transition-transform duration-300 ${
                isScrolled ? 'translate-y-[-1px]' : 'translate-y-0'
              }`}
            >
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

          <div className="flex h-14 items-center justify-between sm:h-16 xl:hidden">
            <Link to="/#about" onClick={handleBrandClick} className="text-[#111111]">
              <p
                className={`font-display origin-left text-[2.35rem] leading-none transition-transform duration-300 will-change-transform sm:text-4xl ${
                  isScrolled ? 'scale-[0.93]' : 'scale-100'
                }`}
              >
                Экспозиция
              </p>
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

      <main ref={mainRef} className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <Outlet />
      </main>

      <footer className="border-t border-[#111111]/8 bg-white/82">
        <div className="mx-auto w-full px-4 py-5 text-center sm:px-6 lg:px-10">
          <p className="text-sm leading-6 text-[#5f5f5f]">© 2026 Фотостудия "Экспозиция".</p>
        </div>
      </footer>
    </div>
  );
}
