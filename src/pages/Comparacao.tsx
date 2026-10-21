import { useEffect, useState } from 'react';
import { compareGame, getComparableGames, type ComparableGame, type Comparison } from '../services/comparison';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPrice = (value: number) => value === 0 ? 'Grátis nesta oferta' : money.format(value / 100);
export function Comparacao() {
  const id = window.location.hash.startsWith('#/comparacao/') ? window.location.hash.slice('#/comparacao/'.length) : '';
  const [games, setGames] = useState<ComparableGame[]>([]);
  const [query, setQuery] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setComparison(null);
    const operation = id ? compareGame(id, controller.signal).then(data => { if (!controller.signal.aborted) setComparison(data); }) : getComparableGames(controller.signal).then(data => { if (!controller.signal.aborted) setGames(data); });
    operation.catch(() => { if (!controller.signal.aborted) setError(id ? 'Não foi possível carregar este jogo para comparação.' : 'Não foi possível carregar os jogos para comparação.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  const matches = games.filter(game => game.nome.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return <>
    <h1>{comparison ? comparison.jogo.nome : 'Comparação de preços'}</h1>
    <p>Ofertas do mesmo jogo e edição na Steam e na Epic Games Store, em reais.</p>
    {loading && <p role="status">{id ? 'Consultando as ofertas das duas lojas…' : 'Carregando jogos para comparar…'}</p>}
    {error && <div><p role="alert" className="!text-red-800">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mb-5 rounded-lg border px-4 py-2">Tentar novamente</button></div>}
    {!id && !loading && !error && <section aria-label="Jogos disponíveis para comparação" className="mt-8">
      <label htmlFor="comparison-search" className="mb-2 block font-semibold">Qual jogo você quer comparar?</label>
      <input id="comparison-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nos jogos disponíveis" className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
      <p className="text-sm">{games.length} {games.length === 1 ? 'jogo disponível' : 'jogos disponíveis'} para comparar. Escolha entre os jogos com correspondência conferida nas duas lojas. A lista é ampliada conforme validamos cada jogo e edição.</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{matches.map(game => <li key={game.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {game.imagem && <img src={game.imagem} alt="" loading="lazy" className="aspect-[231/87] w-full object-cover" />}
        <div className="flex flex-1 flex-col p-5"><h2 className="text-xl font-semibold">{game.nome}</h2><p className="mt-2 text-sm">{game.edicao} · {game.plataforma}</p>
        <a href={`#/comparacao/${game.id}`} className="mt-auto inline-flex rounded-lg bg-brand-purple px-4 py-3 text-sm !text-white">Comparar preços de {game.nome} →</a></div>
      </li>)}</ul>
      {!matches.length && <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="!mb-2">A comparação deste jogo ainda não está disponível. Você pode consultar as ofertas na busca.</p><a href="#/busca">Buscar ofertas nas lojas →</a></div>}
    </section>}
    {comparison && <>
      {comparison.jogo.imagem && <img src={comparison.jogo.imagem} alt="" className="mb-5 aspect-[231/87] w-full max-w-md rounded-xl object-cover" />}
      <p className="text-sm">{comparison.jogo.edicao} · {comparison.jogo.plataforma} · Brasil · BRL</p>
      <section aria-label="Resultado da comparação" className="my-6 rounded-2xl border border-violet-200 bg-violet-50 p-6" aria-live="polite">
        {comparison.situacao === 'comparavel' && comparison.menorPrecoCentavos !== null ? <>
          <h2 className="text-lg font-semibold">{comparison.lojasMenorPreco.length > 1 ? 'Mesmo preço nas duas lojas' : `Menor preço consultado: ${comparison.lojasMenorPreco[0]}`}</h2>
          <p className="mt-3 !mb-2 text-3xl font-bold !text-night">{formatPrice(comparison.menorPrecoCentavos)}</p>
          {!!comparison.economiaCentavos && <p className="!mb-0">Economize {money.format(comparison.economiaCentavos / 100)} em relação à outra loja.</p>}
        </> : <><h2 className="font-semibold">{comparison.situacao === 'parcial' ? 'Comparação parcial' : 'Preços indisponíveis nesta consulta'}</h2><p className="mt-2 !mb-0">Precisamos de preços válidos nas duas lojas para indicar o menor valor e calcular a economia.</p></>}
      </section>
      <ul aria-label="Ofertas das lojas" className="grid gap-5 md:grid-cols-2">{comparison.ofertas.map(offer => <li key={offer.loja} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{offer.loja}</h2>
          {comparison.situacao === 'comparavel' && comparison.lojasMenorPreco.includes(offer.loja) && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">{comparison.lojasMenorPreco.length > 1 ? 'Mesmo preço' : 'Melhor preço consultado'}</span>}
        </div>
        {offer.precoOriginalCentavos != null && <p className="mt-5 !mb-1 text-sm line-through">{money.format(offer.precoOriginalCentavos / 100)}</p>}
        {offer.descontoPercentual != null && offer.descontoPercentual > 0 && <span className="mt-3 w-fit rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-900">−{offer.descontoPercentual}%</span>}
        <p className="mt-5 text-3xl font-bold !text-night">{offer.precoCentavos !== null ? formatPrice(offer.precoCentavos) : offer.situacao === 'sem_preco' ? 'Preço não informado' : 'Oferta indisponível'}</p>
        {offer.mensagem && <p className="text-sm">{offer.mensagem}</p>}
        <p className="!mb-2 text-xs">Fonte: {offer.fonte}.</p>
        {offer.consultadoEm && <p className="!mb-2 text-xs">Consultado em {new Date(offer.consultadoEm).toLocaleString('pt-BR')}.</p>}
        {offer.registroPrecoEm && <p className="text-xs">Registro de preço na fonte: {new Date(offer.registroPrecoEm).toLocaleString('pt-BR')}.</p>}
        <a href={offer.link} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex w-full justify-center rounded-xl bg-brand-purple px-5 py-3 !text-white">Ver {offer.loja === 'Steam' ? 'na Steam' : 'na Epic'} ↗</a>
      </li>)}</ul>
      <p className="mt-6 text-sm">Cada loja utiliza seu próprio aplicativo. Confira preço, edição e condições na loja antes de comprar. As consultas podem usar cache por até cinco minutos.</p>
      <button type="button" onClick={() => setRetry(value => value + 1)} className="mb-6 rounded-lg border border-slate-300 bg-white px-4 py-2">Consultar novamente</button>
    </>}
    <div className="mt-6 flex flex-wrap gap-6">{id && <a href="#/comparacao">Ver jogos disponíveis para comparar</a>}<a href="#/busca">Voltar à busca</a></div>
  </>;
}
