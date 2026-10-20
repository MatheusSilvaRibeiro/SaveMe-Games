import { useEffect, useRef, useState } from 'react';

const games = ['Baldur’s Gate 3', 'Cyberpunk 2077', 'Elden Ring', 'Hades', 'Hollow Knight', 'Stardew Valley'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function Busca() {
  const [query, setQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = games.filter(game => normalize(game).includes(normalize(query)));

  useEffect(() => {
    if (!selectedGame || !dialog.current) return;
    const previousOverflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedGame]);

  const closeDetails = () => dialog.current?.close();

  return (
    <>
      <h1>Busca de jogos</h1>
      <p>Encontre um jogo e selecione para abrir os detalhes. Por enquanto, a busca usa um catálogo de exemplo para testes.</p>

      <section aria-label="Pesquisar jogos" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <label htmlFor="game-search" className="mb-2 block font-semibold">Qual jogo você está procurando?</label>
        <input
          id="game-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Digite o nome do jogo"
          aria-describedby="search-hint"
          aria-controls="search-results"
          className="w-full rounded-xl border border-slate-300 bg-cloud px-4 py-3 text-base"
        />
        <div role="status" className="sr-only">
          {query.trim() ? `${results.length} jogos encontrados.` : ''}
        </div>
        {query.trim() && (
          <ul id="search-results" aria-label="Jogos encontrados" className="mt-2 overflow-hidden rounded-xl border border-slate-200">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-600">Nenhum jogo encontrado. Tente outro nome.</li>
            ) : results.map(game => (
              <li key={game} className="border-b border-slate-100 last:border-b-0">
                <button type="button" onClick={() => setSelectedGame(game)} className="w-full px-4 py-3 text-left font-medium transition-colors hover:bg-violet-50 hover:text-brand-purple focus-visible:-outline-offset-2">
                  {game}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p id="search-hint" className="mt-2 !mb-0 text-sm">Experimente buscar por Hades ou Elden Ring.</p>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold">{query.trim() ? 'Teste de detalhes' : 'Mais pesquisados'}</h2>
        <button type="button" onClick={() => setSelectedGame('Jogo de teste')} className="rounded-xl border border-brand-purple px-4 py-2 font-semibold text-brand-purple hover:bg-violet-50">
          Testar pop-up
        </button>
      </div>
      {!query.trim() && <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map(game => (
          <li key={game}>
            <button type="button" onClick={() => setSelectedGame(game)} className="h-full w-full rounded-2xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-brand-purple hover:bg-violet-50">
              <span className="block font-display text-lg font-semibold">{game}</span>
              <span className="mt-3 block text-sm font-semibold text-brand-purple">Ver detalhes →</span>
            </button>
          </li>
        ))}
      </ul>}

      <dialog ref={dialog} onClose={() => setSelectedGame(null)} onClick={event => { if (event.target === event.currentTarget) closeDetails(); }} aria-labelledby="game-details-title" aria-describedby="game-details-description" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-night shadow-2xl backdrop:bg-slate-950/60">
        <div className="p-6 sm:p-8" onClick={event => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="mb-3 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-brand-purple">WIP · Em desenvolvimento</span>
              <h2 id="game-details-title" className="font-display text-2xl font-semibold">{selectedGame}</h2>
            </div>
            <button type="button" onClick={closeDetails} aria-label="Fechar detalhes" className="rounded-lg px-3 py-1 text-2xl text-slate-600 hover:bg-slate-100">×</button>
          </div>
          <p id="game-details-description" className="mt-5">Os detalhes deste jogo estarão disponíveis em breve. Este pop-up está pronto para testes de navegação.</p>
          <button type="button" onClick={closeDetails} className="w-full rounded-xl bg-brand-purple px-5 py-3 font-semibold text-white hover:bg-violet-800">Voltar à busca</button>
        </div>
      </dialog>
    </>
  );
}
