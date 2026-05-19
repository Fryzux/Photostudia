import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../components/ui/carousel';
import { contacts, hallShowcase, portfolioItems, workflowSteps } from '../data/studio';

import heroVideo from '../../assets/hero-exposition.mp4';
import bgImage from '../../assets/exposition.jpg';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const studioMapEmbedUrl = `https://yandex.ru/map-widget/v1/?ll=37.504%2C55.675&z=16&pt=37.504,55.675,pm2rdm&text=%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82+%D0%92%D0%B5%D1%80%D0%BD%D0%B0%D0%B4%D1%81%D0%BA%D0%BE%D0%B3%D0%BE+86%D0%90`;

  return (
    <div className="pb-8 sm:pb-10">

      {/* HERO С ФОНОМ */}
      <section
        id="about"
        className="soft-fade relative isolate flex min-h-screen min-h-[100svh] w-full scroll-mt-0 items-center justify-center overflow-hidden text-center"
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={bgImage}
        >
          <source src={heroVideo} type="video/mp4" />
        </video>

        {/* Мягкий editorial-слой для читаемости текста без потери фактуры видео. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.18) 44%, rgba(0,0,0,0.34) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),rgba(255,255,255,0)_58%)]" />

        <div className="hero-copy relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-5 pb-14 pt-28 sm:px-8 sm:pb-16">
          <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
            <div className="inline-flex rounded-full border border-white/30 bg-white/12 px-4 py-2 text-[0.68rem] uppercase tracking-[0.3em] text-white shadow-[0_10px_32px_rgba(0,0,0,0.22)] backdrop-blur-md sm:px-5 sm:text-xs sm:tracking-[0.36em]">
              Фотостудия Экспозиция
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h1 className="font-display text-5xl leading-[0.92] text-white drop-shadow-[0_18px_42px_rgba(0,0,0,0.45)] sm:text-7xl lg:text-8xl">
                Экспозиция
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-7 text-white/88 drop-shadow-[0_12px_30px_rgba(0,0,0,0.36)] sm:text-2xl sm:leading-8">
                Каждый кадр - в идеальном свете
              </p>
            </div>

            <div className="flex justify-center">
              <Link to="/halls" className="inline-flex w-full max-w-xs justify-center sm:w-auto sm:max-w-none">
                <Button className="h-14 w-full rounded-full border border-white/45 bg-white px-8 text-xl text-[#111111] shadow-[0_20px_48px_rgba(0,0,0,0.34)] hover:bg-white/90 sm:h-16 sm:min-w-80 sm:px-16 sm:text-2xl">
                  Забронировать зал
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-10 px-4 pt-12 sm:space-y-14 sm:px-6 sm:pt-16 lg:px-10">
      {/* О СТУДИИ */}
      <section data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">О студии</p>
          <h2 className="text-3xl text-foreground sm:text-5xl">Минимализм, где ничто не отвлекает от кадра</h2>
        </div>

      </section>

      {/* ЗАЛЫ */}
      <section id="home-halls" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[112rem] text-center">
        <div className="mb-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">Залы</p>
          <h2 className="text-3xl text-foreground sm:text-5xl">Три спокойных пространства с разным характером</h2>
        </div>

        <div className="px-0.5 md:px-12">
          <Carousel opts={{ align: 'start', loop: true }} autoplay autoplayInterval={4200}>
            <CarouselContent>
              {hallShowcase.map((hall, index) => (
                <CarouselItem key={hall.key} className="md:basis-1/2 lg:basis-1/3 [&>*]:h-full">
                  <article className="mono-panel reveal-card lift-card flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-border text-center" style={{ transitionDelay: `${120 + index * 90}ms` }}>
                    <img src={hall.image} alt={hall.title} className="grayscale-photo h-64 w-full object-cover sm:h-80" />
                    <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Экспозиция</p>
                        <h3 className="text-3xl text-foreground sm:text-4xl">{hall.title}</h3>
                        <p className="text-sm leading-7 text-muted-foreground sm:text-base">{hall.description}</p>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
                          от {hall.price_per_hour.toLocaleString('ru-RU')} ₽ / час
                        </p>
                        <Link to={`/booking?hall_id=${index + 1}`}>
                          <Button className="h-10 w-full rounded-full bg-foreground text-background transition hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-[#111111]/40 sm:h-11">
                            Забронировать
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden border-border bg-card text-foreground md:flex" />
            <CarouselNext className="hidden border-border bg-card text-foreground md:flex" />
          </Carousel>
        </div>
      </section>

      {/* БРОНИРОВАНИЕ */}
      <section id="home-booking" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="mono-panel reveal-card rounded-[2rem] border border-border px-5 py-8 sm:rounded-[2.2rem] sm:px-10 sm:py-10" style={{ transitionDelay: '120ms' }}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">Бронирование</p>
            <h2 className="text-3xl text-foreground sm:text-5xl">Понятный путь от выбора зала до съёмки</h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step}
                className="reveal-card feature-tile feature-tile--step rounded-[1.6rem] border border-border bg-card/70 p-4 text-center sm:p-5"
                style={
                  {
                    transitionDelay: `${190 + index * 70}ms`,
                    '--feature-delay': `${0.26 + index * 0.2}s`,
                  } as CSSProperties
                }
              >
                <p className="feature-step-label text-xs uppercase tracking-[0.32em] text-muted-foreground">Шаг {index + 1}</p>
                <p className="mt-3 text-base leading-7 text-foreground sm:text-lg">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ПОРТФОЛИО */}
      <section id="home-portfolio" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[112rem] text-center">
        <div className="mb-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">Портфолио</p>
          <h2 className="text-3xl text-foreground sm:text-5xl">Кадры в нашей спокойной тональности</h2>
        </div>

        <div className="px-0.5 md:px-12">
          <Carousel opts={{ align: 'start', loop: true }} autoplay autoplayInterval={4300}>
            <CarouselContent>
              {portfolioItems.map((item, index) => (
                <CarouselItem key={item.id} className="sm:basis-1/2 lg:basis-1/3">
                  <article className="mono-panel reveal-card lift-card overflow-hidden rounded-[1.7rem] border border-border text-center" style={{ transitionDelay: `${120 + index * 90}ms` }}>
                    <img src={item.image} alt={item.title} className="grayscale-photo h-64 w-full object-cover sm:h-80" />
                    <div className="space-y-3 p-5 sm:p-6">
                      <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{item.category}</p>
                      <h3 className="text-2xl text-foreground sm:text-3xl">{item.title}</h3>
                      <p className="text-sm leading-7 text-muted-foreground sm:text-base">{item.description}</p>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden border-border bg-card text-foreground md:flex" />
            <CarouselNext className="hidden border-border bg-card text-foreground md:flex" />
          </Carousel>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section id="contacts" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="mono-panel reveal-card rounded-[2rem] border border-border px-5 py-10 sm:rounded-[2.2rem] sm:px-10 sm:py-12" style={{ transitionDelay: '120ms' }}>
          <div className="space-y-6 sm:space-y-8">
            <div className="mx-auto max-w-3xl space-y-4">
              <p className="text-xs uppercase tracking-[0.36em] text-muted-foreground">Контакты</p>
              <h2 className="text-3xl text-foreground sm:text-5xl">
                Приезжайте в Экспозицию за чистым кадром и спокойной атмосферой
              </h2>
            </div>

            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-border bg-card/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Адрес</p>
                <p className="mt-3 text-xl leading-8 text-foreground sm:text-2xl">{contacts.address}</p>
              </div>

              <div className="rounded-[1.5rem] border border-border bg-card/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Связь</p>
                <p className="mt-3 text-xl text-foreground sm:text-2xl">{contacts.phone}</p>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">{contacts.email}</p>
              </div>

              <div className="rounded-[1.5rem] border border-border bg-card/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Режим</p>
                <p className="mt-3 text-xl text-foreground sm:text-2xl">{contacts.hours}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/halls">
                <Button className="h-11 w-full rounded-full border border-foreground/20 bg-foreground px-8 text-background hover:bg-foreground/85 sm:h-12 sm:min-w-56 sm:w-auto">
                  Перейти к залам
                </Button>
              </Link>

              <Link to={isAuthenticated ? '/profile' : '/login'}>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-full border-2 border-foreground bg-foreground/10 px-8 text-foreground hover:bg-foreground/20 dark:border-white/35 dark:bg-white/10 dark:text-white dark:shadow-[0_14px_32px_rgba(0,0,0,0.3)] dark:hover:border-white/50 dark:hover:bg-white/20 sm:h-12 sm:min-w-56 sm:w-auto"
                >
                  Открыть кабинет
                </Button>
              </Link>
            </div>

            <div className="overflow-hidden rounded-[1.7rem] border border-border bg-card/80">
              <div className="border-b border-border px-5 py-4 text-center sm:px-6 sm:py-5">
                <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Карта</p>
                <p className="mt-2 text-base leading-7 text-muted-foreground sm:text-lg">
                  Точка студии у ТЦ «Авеню», проспект Вернадского, 86А.
                </p>
              </div>
              <iframe
                title="Карта фотостудии Экспозиция"
                src={studioMapEmbedUrl}
                loading="lazy"
                allowFullScreen
                className="h-72 w-full sm:h-[420px]"
              />
            </div>

          </div>
        </div>
      </section>

      </div>
    </div>
  );
}
