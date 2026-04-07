import { portfolioItems } from '../data/studio';

export function PortfolioPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mono-panel rounded-[2rem] border border-[#111111]/8 px-5 py-10 text-center sm:px-8 sm:py-12">
        <p className="mb-3 text-xs uppercase tracking-[0.36em] text-[#737373]">Примеры работ</p>
        <h1 className="mx-auto max-w-3xl text-4xl text-[#111111] sm:text-6xl">Подборка съёмок, которые задают визуальный тон студии</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-[#5c5c5c] sm:text-xl sm:leading-8">
          Здесь собраны разные сценарии: fashion, семейные истории, предметка и контент для брендов.
          Страница нужна, чтобы клиент сразу понял диапазон стилей и уровень продакшна.
        </p>
      </section>

      <section className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        {portfolioItems.map((item) => (
          <article key={item.id} className="mono-panel lift-card overflow-hidden rounded-[1.9rem] border border-[#111111]/8 text-center">
            <img src={item.image} alt={item.title} className="grayscale-photo h-72 w-full object-cover sm:h-96" />
            <div className="space-y-4 p-5 sm:p-6">
              <span className="inline-flex rounded-full border border-[#111111]/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#666666]">
                {item.category}
              </span>
              <h2 className="text-3xl text-[#111111] sm:text-4xl">{item.title}</h2>
              <p className="mx-auto max-w-xl text-base leading-7 text-[#5c5c5c] sm:text-lg sm:leading-8">{item.description}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
