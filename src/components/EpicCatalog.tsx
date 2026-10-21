import type { ComparableGame } from '../services/comparison';
import { useEffect, useState } from 'react';
import { searchEpic, type EpicOffer } from '../services/epic';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
interface Props { comparableGames?: ComparableGame[]; term: string; genre: string; priceFilter: string; onGenres: (genres: string[]) => void; }
function EpicArtwork({ src }: { src: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="relative flex aspect-[231/87] w-full items-center justify-center overflow-hidden bg-violet-50">
    {!loaded && <span aria-hidden="true" className="font-display text-xl font-semibold text-brand-purple">SaveMe Games</span>}
    {src && !failed && <img src={src} alt="" loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`absolute inset-0 h-full w-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
  </div>;
}
export function EpicCatalog(props: Props) {
  // Remounting the inner list on term change resets pagination atomically.
  return <EpicList key={props.term} {...props} />;
}
function EpicList({ term, genre, priceFilter, onGenres, comparableGames = [] }: Props) {
  const [items, setItems] = useState<EpicOffer[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    searchEpic(term, controller.signal, page).then(data => {
      if (controller.signal.aborted) return;
      setItems(previous => [...new Map([...previous, ...data.resultados].map(item => [`${item.namespace}:${item.id}`, item])).values()]);
      setNext(data.proximaPagina);
    }).catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar os jogos da Epic.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [term, page, retry]);
  useEffect(() => { onGenres([...new Set(items.flatMap(item => item.generos ?? []))]); }, [items, onGenres]);
  const visible = items.filter(item => (genre === 'all' || item.generos?.includes(genre)) &&
    (priceFilter === 'all' || (priceFilter === 'free' ? item.precoCentavos === 0 : item.precoCentavos != null && item.precoCentavos > 0)));
  return <section aria-label="Jogos da Epic" className="mt-12" aria-busy={busy}>
    <h2 className="font-display text-2xl font-semibold">{term ? 'Resultados na Epic Games Store' : 'Explore a Epic Games Store'}</h2>
    <p className="mt-2 !mb-2 text-sm !leading-5">{term ? 'Jogos para PC encontrados na Epic. Confira a edição e a disponibilidade na loja.' : 'Jogos para PC com preço e página disponíveis para o Brasil.'}</p>
    <p className="!mb-4 text-xs !leading-5">Preços em reais · fonte EGData · confirme as condições na Epic antes de comprar.</p>
    {busy && <p role="status">Carregando jogos da Epic…</p>}
    {error && <div><p className="!text-red-800">{error}</p><button onClick={() => setRetry(value => value + 1)} type="button" className="mb-4 rounded-lg border px-4 py-2">Tentar novamente</button></div>}
    {!busy && !error && !items.length && <p>{next ? 'Nenhuma oferta disponível nesta página. Carregue mais jogos para continuar.' : term ? 'Nenhum jogo encontrado na Epic para esta pesquisa.' : 'Nenhuma oferta disponível na Epic neste momento.'}</p>}
    {!busy && !error && items.length > 0 && !visible.length && <p>Nenhum título da Epic corresponde aos filtros.</p>}
    {items.length > 0 && <p aria-live="polite" className="!mb-5 text-sm !leading-5">{visible.length} {visible.length === 1 ? 'título exibido' : 'títulos exibidos'}.</p>}
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item => <li key={`${item.namespace}:${item.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <EpicArtwork key={item.imagem} src={item.imagem} />
      <div className="flex flex-1 flex-col p-5">
        <p className="!mb-2 text-xs font-semibold uppercase">Epic Games Store · Brasil</p>
        <h3 className="text-lg font-semibold">{item.nome}</h3>
        <p className="mt-3 !mb-3 text-sm !leading-5">{item.sistemas?.length ? item.sistemas.join(' · ') : 'Sistemas não informados'}</p>
        {!!item.generos?.length && <div className="mb-4 flex flex-wrap gap-2">{item.generos.slice(0, 2).map(value => <span key={value} className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-brand-purple">{value}</span>)}</div>}
        <div className="mt-auto border-t border-slate-100 pt-4">
          {item.precoOriginalCentavos != null && <p className="!mb-1 text-sm line-through">{money.format(item.precoOriginalCentavos / 100)}</p>}
          <p className="!mb-3 text-xl font-bold">{item.emBreve ? 'Em breve' : item.precoCentavos === null ? 'Preço não informado para o Brasil' : item.precoCentavos === 0 ? 'Grátis nesta oferta' : money.format(item.precoCentavos / 100)}</p>
          {item.descontoPercentual != null && item.descontoPercentual > 0 && <span className="mb-3 inline-block rounded-md bg-green-100 px-2 py-1 text-sm font-semibold text-green-900">−{item.descontoPercentual}%</span>}
          <a href={item.link ?? `https://store.epicgames.com/pt-BR/browse?q=${encodeURIComponent(item.nome)}&sortBy=relevancy&sortDir=DESC&count=40`} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center rounded-lg bg-brand-purple px-4 py-3 text-sm font-semibold !text-white">{!item.link ? 'Pesquisar na Epic ↗' : item.emBreve || item.precoCentavos === null ? 'Ver página na Epic ↗' : 'Ver oferta na Epic ↗'}</a>
          {comparableGames.filter(game => game.epic.offerId === item.id && game.epic.namespace === item.namespace).map(game => <a key={game.id} href={`#/comparacao/${game.id}`} className="mt-3 block text-center text-sm font-semibold text-brand-purple">Comparar preços nas lojas →</a>)}
          {!item.link && <p className="mt-2 !mb-0 text-xs">Página exata não informada pela fonte. O botão busca este nome na loja.</p>}
        </div>
      </div>
    </li>)}</ul>
    {next && <button type="button" disabled={busy} onClick={() => setPage(next)} className="mt-6 rounded-xl border border-brand-purple px-5 py-3">Carregar mais jogos da Epic</button>}
  </section>;
}
