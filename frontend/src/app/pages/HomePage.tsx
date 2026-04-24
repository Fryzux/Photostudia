import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../components/ui/carousel';
import { contacts, hallShowcase, portfolioItems, valuePoints, workflowSteps } from '../data/studio';

import heroVideo from '../../assets/hero-exposition.mp4';
import bgImage from '../../assets/exposition.jpg';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const studioMapAddress = 'Москва, проспект Вернадского, 86А, ТЦ Авеню';
  const studioMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(studioMapAddress)}&z=16&output=embed`;

  return (
    <div className="space-y-10 pb-8 sm:space-y-14 sm:pb-10">

      {/* HERO С ФОНОМ */}
      <section
        id="about"
        className="soft-fade scroll-mt-32 mx-auto max-w-[112rem] text-center"
        style={{
          position: 'relative',
          borderRadius: '2.4rem',
          overflow: 'hidden',
        }}
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

        {/* мягкий слой для читаемости текста без потери видео */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 100%)',
          }}
        />

        <div className="pointer-events-none absolute inset-0 rounded-[2.4rem] border border-white/65 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-[3.2px]" />

        <div className="relative z-10 rounded-[2.1rem] border border-white/30 bg-transparent px-5 py-12 sm:rounded-[2.4rem] sm:px-10 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-6 px-2 py-6 sm:space-y-8 sm:px-6 sm:py-10">
              <div className="inline-flex rounded-full border border-[#111111]/18 bg-white/82 px-4 py-2 text-[0.68rem] uppercase tracking-[0.3em] text-[#111111] sm:px-5 sm:text-xs sm:tracking-[0.36em]">
                Фотостудия Экспозиция
              </div>

              <div className="space-y-4 sm:space-y-5">
                <h1 className="font-display text-5xl leading-[0.92] text-[#090909] drop-shadow-[0_2px_10px_rgba(255,255,255,0.78)] sm:text-7xl lg:text-8xl">
                  Экспозиция
                </h1>
                <p className="mx-auto max-w-2xl text-lg leading-7 text-[#121212]/95 drop-shadow-[0_1px_8px_rgba(255,255,255,0.6)] sm:text-2xl sm:leading-8">
                  Спокойная фотостудия с чистой геометрией, мягким светом и понятным онлайн-бронированием.
                </p>
              </div>

              <div className="flex justify-center">
                <Link to="/halls" className="inline-flex justify-center">
                  <Button className="h-14 rounded-full border border-white/35 bg-[#111111] px-12 text-xl text-white shadow-[0_16px_30px_rgba(0,0,0,0.28)] hover:bg-[#262626] sm:h-16 sm:min-w-80 sm:px-16 sm:text-2xl">
                    Забронировать зал
                    <ArrowRight className="ml-3 h-6 w-6" />
                  </Button>
                </Link>
              </div>
          </div>
        </div>
      </section>

      {/* О СТУДИИ */}
      <section data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">О студии</p>
          <h2 className="text-3xl text-[#111111] sm:text-5xl">Минимализм, где ничто не отвлекает от кадра</h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {valuePoints.map((point, index) => (
            <Card
              key={point}
              className="mono-panel reveal-card lift-card feature-tile feature-tile--point rounded-[1.7rem] border border-[#111111]/8 text-center"
              style={
                {
                  transitionDelay: `${120 + index * 70}ms`,
                  '--feature-delay': `${0.14 + index * 0.18}s`,
                } as CSSProperties
              }
            >
              <CardContent className="p-5 sm:p-6">
                <p className="text-base leading-7 text-[#484848] sm:text-lg">{point}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ЗАЛЫ */}
      <section id="home-halls" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[112rem] text-center">
        <div className="mb-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">Залы</p>
          <h2 className="text-3xl text-[#111111] sm:text-5xl">Три спокойных пространства с разным характером</h2>
        </div>

        <div className="px-0.5 md:px-12">
          <Carousel opts={{ align: 'start', loop: true }} autoplay autoplayInterval={4200}>
            <CarouselContent>
              {hallShowcase.map((hall, index) => (
                <CarouselItem key={hall.key} className="md:basis-1/2 lg:basis-1/3">
                  <article className="mono-panel reveal-card lift-card overflow-hidden rounded-[1.7rem] border border-[#111111]/8 text-center" style={{ transitionDelay: `${120 + index * 90}ms` }}>
                    <img src={hall.image} alt={hall.title} className="grayscale-photo h-64 w-full object-cover sm:h-80" />
                    <div className="space-y-4 p-5 sm:p-6">
                      <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">Экспозиция</p>
                      <h3 className="text-3xl text-[#111111] sm:text-4xl">{hall.title}</h3>
                      <p className="text-sm leading-7 text-[#5c5c5c] sm:text-base">{hall.description}</p>
                      <p className="text-sm uppercase tracking-[0.28em] text-[#777777]">
                        от {hall.price_per_hour.toLocaleString('ru-RU')} ₽ / час
                      </p>
                      <Link to={`/booking?hall_id=${index + 1}`}>
                        <Button className="h-10 w-full rounded-full bg-[#111111] text-white transition hover:bg-[#2a2a2a] focus-visible:ring-2 focus-visible:ring-[#111111]/40 sm:h-11">
                          Забронировать
                        </Button>
                      </Link>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden border-[#111111]/12 bg-white text-[#111111] md:flex" />
            <CarouselNext className="hidden border-[#111111]/12 bg-white text-[#111111] md:flex" />
          </Carousel>
        </div>
      </section>

      {/* БРОНИРОВАНИЕ */}
      <section id="home-booking" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="mono-panel reveal-card rounded-[2rem] border border-[#111111]/8 px-5 py-8 sm:rounded-[2.2rem] sm:px-10 sm:py-10" style={{ transitionDelay: '120ms' }}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">Бронирование</p>
            <h2 className="text-3xl text-[#111111] sm:text-5xl">Понятный путь от выбора зала до съёмки</h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step}
                className="reveal-card feature-tile feature-tile--step rounded-[1.6rem] border border-[#111111]/8 bg-white/70 p-4 text-center sm:p-5"
                style={
                  {
                    transitionDelay: `${190 + index * 70}ms`,
                    '--feature-delay': `${0.26 + index * 0.2}s`,
                  } as CSSProperties
                }
              >
                <p className="feature-step-label text-xs uppercase tracking-[0.32em] text-[#737373]">Шаг {index + 1}</p>
                <p className="mt-3 text-base leading-7 text-[#4a4a4a] sm:text-lg">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ПОРТФОЛИО */}
      <section id="home-portfolio" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[112rem] text-center">
        <div className="mb-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">Портфолио</p>
          <h2 className="text-3xl text-[#111111] sm:text-5xl">Кадры в нашей спокойной тональности</h2>
        </div>

        <div className="px-0.5 md:px-12">
          <Carousel opts={{ align: 'start', loop: true }} autoplay autoplayInterval={4300}>
            <CarouselContent>
              {portfolioItems.map((item, index) => (
                <CarouselItem key={item.id} className="sm:basis-1/2 lg:basis-1/3">
                  <article className="mono-panel reveal-card lift-card overflow-hidden rounded-[1.7rem] border border-[#111111]/8 text-center" style={{ transitionDelay: `${120 + index * 90}ms` }}>
                    <img src={item.image} alt={item.title} className="grayscale-photo h-64 w-full object-cover sm:h-80" />
                    <div className="space-y-3 p-5 sm:p-6">
                      <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">{item.category}</p>
                      <h3 className="text-2xl text-[#111111] sm:text-3xl">{item.title}</h3>
                      <p className="text-sm leading-7 text-[#5c5c5c] sm:text-base">{item.description}</p>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden border-[#111111]/12 bg-white text-[#111111] md:flex" />
            <CarouselNext className="hidden border-[#111111]/12 bg-white text-[#111111] md:flex" />
          </Carousel>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section id="contacts" data-reveal="section" className="reveal-section scroll-mt-32 mx-auto max-w-[108rem] text-center">
        <div className="mono-panel reveal-card rounded-[2rem] border border-[#111111]/8 px-5 py-10 sm:rounded-[2.2rem] sm:px-10 sm:py-12" style={{ transitionDelay: '120ms' }}>
          <div className="space-y-6 sm:space-y-8">
            <div className="mx-auto max-w-3xl space-y-4">
              <p className="text-xs uppercase tracking-[0.36em] text-[#737373]">Контакты</p>
              <h2 className="text-3xl text-[#111111] sm:text-5xl">
                Приезжайте в Экспозицию за чистым кадром и спокойной атмосферой
              </h2>
            </div>

            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-[#111111]/8 bg-white/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">Адрес</p>
                <p className="mt-3 text-xl leading-8 text-[#111111] sm:text-2xl">{contacts.address}</p>
              </div>

              <div className="rounded-[1.5rem] border border-[#111111]/8 bg-white/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">Связь</p>
                <p className="mt-3 text-xl text-[#111111] sm:text-2xl">{contacts.phone}</p>
                <p className="mt-1 text-sm text-[#5c5c5c] sm:text-base">{contacts.email}</p>
              </div>

              <div className="rounded-[1.5rem] border border-[#111111]/8 bg-white/70 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">Режим</p>
                <p className="mt-3 text-xl text-[#111111] sm:text-2xl">{contacts.hours}</p>
              </div>
            </div>

<<<<<<< HEAD
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/halls">
                <Button className="h-11 w-full rounded-full bg-[#111111] px-8 text-white hover:bg-[#2a2a2a] sm:h-12 sm:min-w-56 sm:w-auto">
                  Перейти к залам
                </Button>
              </Link>

              <Link to={isAuthenticated ? '/profile' : '/login'}>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-full border-[#111111]/12 bg-white px-8 text-[#111111] hover:bg-[#f1f1ee] sm:h-12 sm:min-w-56 sm:w-auto"
                >
                  Открыть кабинет
                </Button>
              </Link>
=======
            <div className="overflow-hidden rounded-[1.7rem] border border-[#111111]/8 bg-white/80">
              <div className="border-b border-[#111111]/8 px-5 py-4 text-center sm:px-6 sm:py-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[#737373]">Карта</p>
                <p className="mt-2 text-base leading-7 text-[#4f4f4f] sm:text-lg">
                  Точка студии у ТЦ «Авеню», проспект Вернадского, 86А.
                </p>
              </div>
              <iframe
                title="Карта фотостудии Экспозиция"
                src={studioMapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-72 w-full sm:h-[420px]"
              />
>>>>>>> origin/frontend-osip
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
