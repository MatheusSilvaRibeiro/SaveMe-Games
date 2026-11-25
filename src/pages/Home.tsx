export function Home() {
  return (
    <section
      aria-labelledby="home-title"
      className="rounded-3xl bg-night bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-purple),transparent_65%)] px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16 lg:py-20"
    >
      <p className="mb-4 text-sm font-semibold text-violet-200">SaveMe Games</p>
      <h1 id="home-title" className="max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl">
        Mais tempo jogando.
        <span className="block text-violet-200">Menos tempo pesquisando.</span>
      </h1>
      <p className="mb-8 max-w-lg text-base text-slate-200 sm:text-lg">
        Encontre jogos, compare ofertas da Steam e da Epic e acompanhe quedas de preço nos seus favoritos.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="#/busca" className="inline-flex min-h-12 items-center rounded-xl bg-white px-5 text-sm text-night transition-colors hover:bg-violet-100 hover:no-underline">
          Buscar jogos
        </a>
        <a href="#/comparacao" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-5 text-sm text-white transition-colors hover:bg-white/10 hover:no-underline">
          Comparar preços
        </a>
      </div>
    </section>
  );
}
