import type { ComparableGame } from '../services/comparison';
import { useEffect, useState } from 'react';
import { searchEpic, type EpicOffer } from '../services/epic';
import type { useFavorites } from '../services/favorites';
import { FavoriteToggle } from './FavoriteButton';
import { SearchGameArtwork, cardActionStyle, cardBodyStyle, cardPriceStyle, cardStoreStyle, cardStyle, cardTitleStyle } from './SearchGameCard';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
interface Props { comparableGames?: ComparableGame[]; favorites: ReturnType<typeof useFavorites>; term: string; genre: string; priceFilter: string; onGenres: (genres: string[]) => void; }
export function EpicCatalog(props: Props) {
  // Remounting the inner list on term change resets pagination atomically.
  return <EpicList key={props.term} {...props} />;
}
function EpicList({ term, genre, priceFilter, onGenres, comparableGames = [], favorites }: Props) {
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
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item => {
      const comparable = comparableGames.find(game => game.epic.offerId === item.id && game.epic.namespace === item.namespace);
      const link = item.link ?? `https://store.epicgames.com/pt-BR/browse?q=${encodeURIComponent(item.nome)}&sortBy=relevancy&sortDir=DESC&count=40`;
      const favorite = comparable ?? { id: `epic-${item.namespace.toLowerCase()}-${item.id.toLowerCase()}`, nome: item.nome, edicao: 'Epic Games Store', plataforma: 'PC', imagem: item.imagem, link };
      return <li key={`${item.namespace}:${item.id}`} className={cardStyle}>
      <SearchGameArtwork key={item.imagem} src={item.imagem} />
      <div className={cardBodyStyle}>
        <span className={cardStoreStyle}>Epic Games Store · Brasil</span>
        <h3 className={cardTitleStyle}>{item.nome}</h3>
        <span className="mt-3 block text-sm text-slate-600">{item.sistemas?.length ? item.sistemas.join(' · ') : 'Sistemas não informados'}</span>
        {!!item.generos?.length && <div className="mb-4 flex flex-wrap gap-2">{item.generos.slice(0, 2).map(value => <span key={value} className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-brand-purple">{value}</span>)}</div>}
        <div className={cardPriceStyle}>
          <div>
            {item.precoOriginalCentavos != null && <span className="block text-sm text-slate-500 line-through">{money.format(item.precoOriginalCentavos / 100)}</span>}
            <span className="block text-xl font-bold text-night">{item.emBreve ? 'Em breve' : item.precoCentavos === null ? 'Preço não informado para o Brasil' : item.precoCentavos === 0 ? 'Grátis nesta oferta' : money.format(item.precoCentavos / 100)}</span>
          </div>
          {item.descontoPercentual != null && item.descontoPercentual > 0 && <span className="rounded-md bg-green-100 px-2 py-1 text-sm font-semibold text-green-900">−{item.descontoPercentual}%</span>}
        </div>
      </div>
      <div className="grid gap-2 px-5 pb-5">
        {comparable
          ? <a href={`#/comparacao/${comparable.id}`} className={cardActionStyle}>Comparar preços</a>
          : <a href={link} target="_blank" rel="noopener noreferrer" className={cardActionStyle}>Visualizar preço</a>}
        <FavoriteToggle card game={favorite} favorites={favorites} />
        {!item.link && !comparable && <p className="!mb-0 text-xs">Página exata não informada pela fonte. O botão busca este nome na loja.</p>}
      </div>
    </li>;
    })}</ul>
    {next && <button type="button" disabled={busy} onClick={() => setPage(next)} className="mt-6 rounded-xl border border-brand-purple px-5 py-3">Carregar mais jogos da Epic</button>}
  </section>;
}
