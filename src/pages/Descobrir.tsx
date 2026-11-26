import { useEffect, useMemo, useRef, useState } from 'react';
import { getFeatured, type SearchItem } from '../services/steam';
import { getComparableGames, type ComparableGame } from '../services/comparison';
import { SearchGameArtwork } from '../components/SearchGameCard';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const tabs = [['all', 'Para explorar'], ['top_sellers', 'Mais vendidos'], ['specials', 'Em oferta'], ['new_releases', 'Novidades']] as const;
export function Descobrir({ preview = false }: { preview?: boolean }) {
  const [initial] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? ''));
  const [items, setItems] = useState<SearchItem[]>([]), [catalog, setCatalog] = useState<ComparableGame[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [next, setNext] = useState<number | null>(null), [more, setMore] = useState(false);
  const [tab, setTab] = useState(initial.get('section') || 'all'), [genre, setGenre] = useState('all');
  const [priceMode, setPriceMode] = useState(initial.has('budget') ? 'budget' : 'all');
  const [budget, setBudget] = useState(Math.min(200, Math.max(10, Number(initial.get('budget')) || 50)));
  const [order, setOrder] = useState('source');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getFeatured(controller.signal).then(data => { if (!controller.signal.aborted) { setItems(data.resultados); setNext(data.proximaPagina ?? null); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar os jogos.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    getComparableGames(controller.signal).then(data => { if (!controller.signal.aborted) setCatalog(data); }).catch(() => {});
    return () => controller.abort();
  }, [retry]);
  const moreRequest = useRef<AbortController | null>(null);
  useEffect(() => () => moreRequest.current?.abort(), []);
  async function loadMore() {
    if (more || !next) return;
    const controller = new AbortController(); moreRequest.current = controller; setMore(true); setError('');
    try {
      const data = await getFeatured(controller.signal, next);
      if (!controller.signal.aborted) { setItems(previous => [...new Map([...previous, ...data.resultados].map(item => [item.appId, item])).values()]); setNext(data.proximaPagina ?? null); }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar mais jogos.'); }
    finally { if (!controller.signal.aborted) setMore(false); }
  }
  const genres = useMemo(() => [...new Set(items.flatMap(item => item.generos ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items]);
  const selected = useMemo(() => {
    const filtered = items.filter(item => item.tipo === 'game' && (tab === 'all' || item.destaques?.includes(tab)) && (genre === 'all' || item.generos?.includes(genre)) &&
      (priceMode === 'all' || (typeof item.precoCentavos === 'number' && (priceMode === 'free' ? item.precoCentavos === 0 : item.precoCentavos <= budget * 100))));
    if (order === 'price') filtered.sort((a, b) => (a.precoCentavos ?? Infinity) - (b.precoCentavos ?? Infinity));
    if (order === 'discount') filtered.sort((a, b) => (b.descontoPercentual ?? 0) - (a.descontoPercentual ?? 0));
    return filtered;
  }, [items, tab, genre, priceMode, budget, order]);
  const shown = preview ? selected.slice(0, 3) : selected;
  function reset() { setTab('all'); setGenre('all'); setPriceMode('all'); setOrder('source'); }
  const title = preview ? 'Seu pr\u00f3ximo jogo pode estar aqui.' : 'O que vamos jogar hoje?';
  return <section aria-labelledby="discover-title" className={preview ? 'mt-16' : ''}>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="!mb-2 text-xs font-bold uppercase tracking-[0.2em] !text-brand-purple">DESCUBRA COM O SAVEME</p>
      {preview ? <h2 id="discover-title" className="font-display text-3xl font-semibold">{title}</h2> : <h1 id="discover-title">{title}</h1>}
      <p className="mt-3 !mb-0 max-w-2xl">Destaques da Steam, seu estilo e um pre&ccedil;o que cabe no seu bolso. Escolha por onde come&ccedil;ar.</p></div>
      {preview && <a href="#/descobrir" className="rounded-xl border border-violet-200 px-5 py-3 font-semibold">Explorar todos os destaques &rarr;</a>}
    </div>
    {!preview && <div className="mb-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Tipo de descoberta">{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-brand-purple text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:border-violet-400'}`}>{label}</button>)}</div>
      <div className="grid gap-6 md:grid-cols-3">
        <div><label htmlFor="discover-genre" className="mb-2 block text-sm font-semibold">Qual &eacute; a sua vibe?</label><select id="discover-genre" value={genre} onChange={e => setGenre(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="all">Todos os g&ecirc;neros</option>{genres.map(value => <option key={value}>{value}</option>)}</select></div>
        <div><label htmlFor="discover-price" className="mb-2 block text-sm font-semibold">Quanto quer gastar?</label><select id="discover-price" value={priceMode} onChange={e => setPriceMode(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="all">Quero explorar sem limite</option><option value="budget">Definir meu or&ccedil;amento</option><option value="free">S&oacute; jogos gr&aacute;tis</option></select>
        {priceMode === 'budget' && <div className="mt-3"><label htmlFor="discover-budget" className="block text-sm">At&eacute; <strong>{money.format(budget)}</strong></label><input id="discover-budget" type="range" min="10" max="200" step="10" value={budget} onChange={e => setBudget(Number(e.target.value))} className="mt-2 w-full accent-violet-700" /></div>}</div>
        <div><label htmlFor="discover-order" className="mb-2 block text-sm font-semibold">O que importa mais?</label><select id="discover-order" value={order} onChange={e => setOrder(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="source">Ordem dos destaques</option><option value="price">Menor pre&ccedil;o</option><option value="discount">Maior desconto</option></select></div>
      </div>
    </div>}
    {loading && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8">Buscando ideias para sua pr&oacute;xima jogatina...</div>}
    {error && <div role="alert" className="my-5 rounded-xl border border-red-200 bg-red-50 p-5"><p>{error}</p><button onClick={() => { setError(''); if (items.length && next) void loadMore(); else setRetry(value => value + 1); }} className="min-h-11 rounded-lg border border-red-200 px-4">Tentar novamente</button></div>}
    {!loading && <>
      <p aria-live="polite" className="text-sm">{shown.length} {shown.length === 1 ? 'jogo nesta sele\u00e7\u00e3o' : 'jogos nesta sele\u00e7\u00e3o'}{!preview && ` entre ${items.length} destaques carregados`}. Pre&ccedil;os da Steam em reais.</p>
      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{shown.map(item => {
        const match = catalog.find(game => game.steam.appId === item.appId);
        const price = item.precoCentavos;
        const discount = item.descontoPercentual;
        const reason = tab === 'new_releases' ? 'Nas novidades da Steam' : tab === 'top_sellers' ? 'Entre os mais vendidos na Steam' : typeof discount === 'number' && discount > 0 ? 'Uma oportunidade para economizar' : 'Nos destaques da Steam';
        return <li key={item.appId} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg motion-reduce:transform-none">
          <SearchGameArtwork src={item.imagem} /><div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-brand-purple">{item.destaques?.includes('top_sellers') ? 'Mais vendidos na Steam' : 'Destaque Steam'}</span>{typeof discount === 'number' && discount > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">-{discount}%</span>}</div>
          <h3 className="font-display text-xl font-semibold">{item.nome}</h3><p className="mt-2 !mb-3 text-sm">{(item.generos ?? []).slice(0, 3).join(' \u00b7 ') || 'Explore os detalhes na loja'}</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs !text-slate-600">{reason}{priceMode === 'budget' ? ' e dentro do seu or\u00e7amento.' : '.'}</p>
          <div className="mt-auto border-t border-slate-100 pt-4"><p className="!mb-1 text-xs !text-slate-500">Na Steam</p>{typeof item.precoOriginalCentavos === 'number' && typeof price === 'number' && item.precoOriginalCentavos > price && <del className="mr-2 text-sm text-slate-400">{money.format(item.precoOriginalCentavos / 100)}</del>}<span className="text-2xl font-bold text-night">{price === 0 ? 'Gr\u00e1tis' : typeof price === 'number' ? money.format(price / 100) : 'Pre\u00e7o indispon\u00edvel'}</span>
          <a href={match ? `#/comparacao/${match.id}` : `#/busca?q=${encodeURIComponent(item.nome)}`} className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-brand-purple px-4 py-3 text-sm font-semibold !text-white hover:bg-violet-900">{match ? 'Comparar Steam e Epic' : 'Explorar ofertas deste jogo'} &rarr;</a>
          </div></div></li>;
      })}</ul>
      {!shown.length && !error && <div className="rounded-2xl border border-dashed border-violet-300 bg-white p-8"><h3 className="text-xl font-semibold">Vamos ajustar a busca?</h3><p>Nenhum dos destaques carregados combina com esses filtros. Experimente outro or&ccedil;amento ou carregue mais jogos.</p><button onClick={reset} className="min-h-11 rounded-lg border px-4">Limpar filtros</button></div>}
      {!preview && next && <button type="button" disabled={more} onClick={() => void loadMore()} className="mx-auto mt-8 block min-h-12 rounded-xl border border-violet-200 bg-white px-6 font-semibold text-brand-purple disabled:opacity-60">{more ? 'Carregando...' : 'Descobrir mais jogos'}</button>}
    </>}
    <p className="mt-6 text-xs !text-slate-500">Fonte: destaques da Steam, incluindo mais vendidos, ofertas e novidades. Os filtros usam apenas os jogos carregados; esta sele&ccedil;&atilde;o n&atilde;o &eacute; um ranking global nem uma recomenda&ccedil;&atilde;o personalizada. Pre&ccedil;os podem mudar. <a href="#/busca">Procurando um jogo espec&iacute;fico?</a></p>
  </section>;
}
