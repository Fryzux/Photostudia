import { portfolioItems } from '../data/studio';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../components/ui/carousel';

export function PortfolioPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section data-reveal="section" className="reveal-section mono-panel rounded-[2rem] border border-border px-5 py-10 text-center sm:px-8 sm:py-12">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-muted-foreground">Примеры работ</p>
        <h1 className="mx-auto max-w-3xl text-4xl text-foreground sm:text-6xl">Подборка съёмок, которые задают визуальный тон студии</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
          Здесь собраны разные сценарии: fashion, семейные истории, предметка и контент для брендов.
          Страница нужна, чтобы клиент сразу понял диапазон стилей и уровень продакшна.
        </p>
      </section>

      <section data-reveal="section" className="reveal-section px-0.5 md:px-12">
        <Carousel opts={{ align: 'start', loop: true }} autoplay autoplayInterval={4400}>
          <CarouselContent>
            {portfolioItems.map((item, index) => (
              <CarouselItem key={item.id} className="lg:basis-1/2">
                <article className="reveal-card mono-panel lift-card overflow-hidden rounded-[1.9rem] border border-border text-center" style={{ transitionDelay: `${100 + index * 70}ms` }}>
                  <img src={item.image} alt={item.title} className="grayscale-photo h-72 w-full object-cover sm:h-96" />
                  <div className="space-y-4 p-5 sm:p-6">
                    <span className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {item.category}
                    </span>
                    <h2 className="text-3xl text-foreground sm:text-4xl">{item.title}</h2>
                    <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{item.description}</p>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden border-border bg-card text-foreground md:flex" />
          <CarouselNext className="hidden border-border bg-card text-foreground md:flex" />
        </Carousel>
      </section>
    </div>
  );
}
