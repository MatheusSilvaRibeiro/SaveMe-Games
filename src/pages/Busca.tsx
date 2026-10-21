import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getGame, searchGames, type GameDetails, type SearchItem } from '../services/steam';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a consulta.';
const contentTypes: Record<string, { label: string; note?: string }> = {
  game: { label: 'Jogo' },
  dlc: { label: 'DLC / conteúdo adicional', note: 'Confira na Steam se este conteúdo exige o jogo base.' },
  demo: { label: 'Demonstração', note: 'Este resultado é uma demonstração, não a versão completa do jogo.' },
  music: { label: 'Trilha sonora', note: 'Este resultado é uma trilha sonora, não o jogo.' },
  video: { label: 'Vídeo' },
  mod: { label: 'Modificação (mod)' },
  application: { label: 'Aplicativo' },
  tool: { label: 'Ferramenta' },
};
function contentInfo(type: string | null) {
  return type && Object.hasOwn(contentTypes, type)
    ? contentTypes[type]!
    : { label: 'Tipo não identificado', note: 'Não foi possível identificar o tipo deste conteúdo. Confira a descrição na Steam.' };
}
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function Busca() {
  const [query, setQuery] = useState('');
  const [searchedTerm, setSearchedTerm] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedGame, setSelectedGame] = useState<SearchItem | null>(null);
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const searchRequest = useRef<AbortController | null>(null);

  useEffect(() => () => searchRequest.current?.abort(), []);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchRequest.current?.abort();
    const term = query.trim();
    setResults([]); setSearchError(''); setSearchedTerm(''); setLoading(false);
    if (term.length < 2 || term.length > 100) {
      setSearchError('Digite entre 2 e 100 caracteres para pesquisar.');
      return;
    }
    const controller = new AbortController();
    searchRequest.current = controller;
    setLoading(true);
    try {
      const response = await searchGames(term, controller.signal);
      if (!controller.signal.aborted) { setResults(response.resultados); setSearchedTerm(term); }
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedGame || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controller = new AbortController();
    setDetails(null); setDetailsError('');
    getGame(selectedGame.appId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setDetails(data); })
      .catch(error => { if (!controller.signal.aborted) setDetailsError(errorMessage(error)); });
    return () => { controller.abort(); document.body.style.overflow = previousOverflow; };
  }, [selectedGame]);

  const closeDetails = () => dialog.current?.close();
  const openGame = (game: SearchItem) => { setDetails(null); setDetailsError(''); setSelectedGame(game); };

  return (
    <>
      <h1>Busca de jogos</h1>
      <p>Pesquise um título e consulte sua oferta na Steam. Nesta versão, as consultas são para o Brasil, em reais.</p>
      <section aria-label="Pesquisar jogos" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <form onSubmit={submitSearch}>
          <label htmlFor="game-search" className="mb-2 block font-semibold">Qual jogo você está procurando?</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input id="game-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
              maxLength={100} placeholder="Digite o nome do jogo" aria-describedby="search-hint"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-cloud px-4 py-3 text-base" />
            <button type="submit" disabled={loading} className="rounded-xl bg-brand-purple px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
          <p id="search-hint" className="mt-3 !mb-0 text-sm">Digite ao menos 2 caracteres e pressione Enter ou Buscar.</p>
        </form>
      </section>
      <section aria-label="Resultados da busca" aria-busy={loading} className="mt-8">
        <div role="status" aria-live="polite">
          {loading && <p>Consultando a Steam…</p>}
          {!loading && searchedTerm && <p>{results.length ? `${results.length} resultados para “${searchedTerm}”.` : `Nenhum resultado para “${searchedTerm}”. Tente outro nome.`}</p>}
        </div>
        {searchError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 !text-red-800">{searchError}</p>}
        {results.length > 0 && <>
          <h2 className="mb-4 font-display text-xl font-semibold">Selecione o título desejado</h2>
          <p className="text-sm">A pesquisa também pode encontrar complementos e trilhas sonoras. Confira o conteúdo antes de comprar.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(game => <li key={game.appId}>
              <button type="button" onClick={() => openGame(game)} className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-colors hover:border-brand-purple hover:bg-violet-50">
                {game.imagem && <img src={game.imagem} alt="" loading="lazy" className="aspect-[231/87] w-full object-cover" />}
                <span className="flex flex-1 flex-col p-5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Steam · Brasil</span>
                  <span className="mt-2 block font-display text-lg font-semibold leading-snug">{game.nome}</span>
                  <span className="mt-3 block text-sm text-slate-600">{game.sistemas?.length ? game.sistemas.join(' · ') : 'Sistemas não informados'}</span>
                  <span className="mt-4 block text-sm text-slate-600">
                    {game.metacritic != null ? <>Metacritic <strong className="text-night">{game.metacritic}/100</strong></> : 'Sem nota Metacritic disponível'}
                  </span>
                  <span className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <span>
                      {game.precoOriginalCentavos != null && <span className="block text-sm text-slate-500 line-through">{money.format(game.precoOriginalCentavos / 100)}</span>}
                      <span className="block text-xl font-bold text-night">{game.precoCentavos == null ? 'Preço sob consulta' : money.format(game.precoCentavos / 100)}</span>
                    </span>
                    {game.descontoPercentual != null && game.descontoPercentual > 0 && <span className="rounded-md bg-green-100 px-2 py-1 text-sm font-semibold text-green-900">−{game.descontoPercentual}%</span>}
                  </span>
                  <span className="mt-4 block text-sm font-semibold text-brand-purple">Ver oferta na Steam →</span>
                </span>
              </button>
            </li>)}
          </ul>
        </>}
      </section>
      <dialog ref={dialog} onClose={() => { setSelectedGame(null); setDetails(null); setDetailsError(''); }}
        onClick={event => { if (event.target === event.currentTarget) closeDetails(); }}
        aria-labelledby="game-details-title" aria-describedby="game-details-description"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-night shadow-2xl backdrop:bg-slate-950/60">
        <div className="p-6 sm:p-8" onClick={event => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <h2 id="game-details-title" className="font-display text-2xl font-semibold">{selectedGame?.nome}</h2>
            <button type="button" onClick={closeDetails} aria-label="Fechar detalhes" className="rounded-lg px-3 py-1 text-2xl text-slate-600 hover:bg-slate-100">×</button>
          </div>
          <p id="game-details-description" className="mt-3 text-sm">Oferta da Steam para o Brasil. Confira preço e condições na loja antes de comprar.</p>
          {selectedGame && !details && !detailsError && <p role="status">Consultando detalhes e preço…</p>}
          {detailsError && <div><p role="alert" className="!text-red-800">{detailsError}</p>
            <button type="button" onClick={() => selectedGame && openGame({ ...selectedGame })} className="mb-4 rounded-lg border border-brand-purple px-4 py-2 text-brand-purple">Tentar novamente</button></div>}
          {details && <>
            {details.imagem && <img src={details.imagem} alt="" className="mb-5 w-full rounded-xl" />}
            <p className="!mb-3 text-sm"><strong>Tipo de conteúdo:</strong> {contentInfo(details.tipo).label}</p>
            {contentInfo(details.tipo).note && <p className="text-sm">{contentInfo(details.tipo).note}</p>}
            <dl className="mb-6 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-slate-200 py-4 text-sm">
              <div><dt className="text-slate-500">Gêneros</dt><dd className="mt-1 font-medium">{details.generos?.length ? details.generos.join(', ') : 'Não informados'}</dd></div>
              <div><dt className="text-slate-500">Desenvolvedora</dt><dd className="mt-1 font-medium">{details.desenvolvedoras?.length ? details.desenvolvedoras.join(', ') : 'Não informada'}</dd></div>
              <div><dt className="text-slate-500">{details.emBreve ? 'Lançamento previsto' : 'Lançamento'}</dt><dd className="mt-1 font-medium">{details.lancamento || 'Não informado'}</dd></div>
              <div><dt className="text-slate-500">Sistemas</dt><dd className="mt-1 font-medium">{details.sistemas?.length ? details.sistemas.join(', ') : 'Não informados'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Avaliação Metacritic</dt><dd className="mt-1 font-medium">{details.metacritic != null ? `${details.metacritic}/100 · nota da crítica, fornecida pela Steam` : 'Sem nota disponível'}</dd></div>
            </dl>
            <p className="!mb-2 text-sm">Steam · Brasil</p>
            {details.precoOriginalCentavos != null && <p className="!mb-1 text-sm line-through">{money.format(details.precoOriginalCentavos / 100)}</p>}
            <p className="!mb-4 font-display text-3xl font-semibold !text-night">
              {details.precoCentavos === null ? 'Preço indisponível' : details.situacaoPreco === 'gratuito' ? 'Gratuito' : money.format(details.precoCentavos / 100)}
            </p>
            <p className="text-sm">Consultado em {new Date(details.consultadoEm).toLocaleString('pt-BR')}.</p>
            <a href={`https://store.steampowered.com/app/${details.appId}/`} target="_blank" rel="noopener noreferrer"
              className="mb-4 inline-flex w-full items-center justify-center rounded-xl bg-brand-purple px-5 py-3 !text-white">Ver na Steam ↗</a>
          </>}
          <button type="button" onClick={closeDetails} className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-cloud">Voltar à busca</button>
        </div>
      </dialog>
    </>
  );
}
