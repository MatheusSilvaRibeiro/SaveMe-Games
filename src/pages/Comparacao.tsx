import { useEffect, useRef, useState, type FormEvent } from 'react';
import { findComparisons, loadComparison, type Candidate, type Offer } from '../services/comparison';
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const date = (value: string) => Number.isNaN(Date.parse(value)) ? 'Não informado' : new Date(value).toLocaleString('pt-BR');
export function Comparacao() {
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [more, setMore] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void search(undefined, '');
    return () => { controller.current?.abort(); if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);
  function start() { controller.current?.abort(); const next = new AbortController(); controller.current = next; setErrors([]); setLoading(true); return next; }
  async function search(event?: FormEvent, term = query.trim()) {
    event?.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if ((term.length > 0 && term.length < 2) || term.length > 100) { setErrors(['Digite entre 2 e 100 caracteres para pesquisar.']); return; }
    const request = start(); setQuery(term); setSelected(null); setOffers([]); setGames([]); setSearched(!!term);
    try { const data = await findComparisons(term, request.signal); if (!request.signal.aborted) { setGames(data.games); setErrors(data.errors); setMore(data.more); } }
    catch { if (!request.signal.aborted) setErrors(['Não foi possível buscar os jogos. Tente novamente.']); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  function changeQuery(value: string) {
    setQuery(value); controller.current?.abort();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSelected(null); setOffers([]); setGames([]); setErrors([]); setMore(false);
    const term = value.trim();
    setSearched(!!term); setLoading(term.length !== 1);
    if (term.length === 1) return;
    searchTimer.current = setTimeout(() => void search(undefined, term), 450);
  }
  async function select(game: Candidate) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const request = start(); setSelected(game); setOffers([]);
    try { const data = await loadComparison(game, request.signal); if (!request.signal.aborted) { setOffers(data.offers); setErrors(data.errors); } }
    catch { if (!request.signal.aborted) setErrors(['Não foi possível atualizar os preços.']); }
    finally { if (!request.signal.aborted) { setLoading(false); result.current?.focus(); } }
  }
  const prices = offers.flatMap(offer => offer.price === null ? [] : [offer.price]);
  const comparable = prices.length === 2;
  const min = Math.min(...prices), max = Math.max(...prices);
  const saving = comparable ? max - min : 0;
  return <div className="-mt-6 lg:-mt-10">
    <section className="relative isolate overflow-hidden rounded-3xl bg-night px-6 py-10 text-white sm:p-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 -z-10 size-96 rounded-full bg-brand-purple/50 blur-3xl" />
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wider"><span className="size-2 rounded-full bg-emerald-400" /> STEAM + EPIC · BRASIL</span>
      <h1 className="!mb-4 max-w-2xl !text-4xl !leading-tight sm:!text-5xl">O mesmo jogo.<br /><span className="text-violet-300">A melhor escolha.</span></h1>
      <p className="!mb-8 !text-slate-300">Seu próximo gameplay começa com uma boa compra. Compare os preços em reais e descubra onde seu dinheiro rende mais.</p>
      <form onSubmit={search} className="flex max-w-3xl flex-col gap-3 sm:flex-row">
        <label htmlFor="compare-search" className="sr-only">Qual jogo você quer comparar?</label>
        <input id="compare-search" type="search" minLength={2} maxLength={100} value={query} onChange={event => changeQuery(event.target.value)} placeholder="Qual jogo você quer comparar?" aria-describedby="compare-search-hint" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-5 py-4 text-night shadow-sm" />
        <button type="submit" className="rounded-xl bg-brand-purple px-7 py-4 font-semibold text-white transition hover:bg-violet-700">Comparar preços ↗</button>
      </form>
      <p id="compare-search-hint" className="!mb-0 mt-3 text-xs !text-slate-300">A partir de 2 caracteres, os jogos aparecem automaticamente.</p>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-300"><span>Experimente:</span>{['Celeste', 'Hades', 'Cyberpunk 2077'].map(term => <button key={term} onClick={() => void search(undefined, term)} className="rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10">{term}</button>)}</div>
    </section>
    <div role="status" aria-live="polite" className="mt-6 text-sm text-slate-600">{loading ? selected ? 'Atualizando preços nas lojas…' : 'Buscando nas duas lojas…' : query.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : searched && !selected ? `${games.length} títulos encontrados. Selecione o título e a edição que deseja comparar.` : ''}</div>
    {errors.map(error => <p key={error} role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 !text-amber-900">{error}</p>)}
    {selected ? <div ref={result} tabIndex={-1} className="mt-6 outline-none" aria-busy={loading}>
      <button onClick={() => { controller.current?.abort(); setLoading(false); setSelected(null); setErrors([]); }} className="mb-5 text-sm font-semibold text-brand-purple">← Voltar aos resultados</button>
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        {selected.imagem && <img src={selected.imagem} alt="" className="aspect-video w-full rounded-xl object-cover sm:w-48" />}
        <div><span className="text-xs font-semibold uppercase tracking-widest text-brand-purple">Seu jogo, suas opções</span><h2 className="mt-2 font-display text-2xl font-semibold">{selected.nome}</h2><p className="!mb-0 mt-2 text-sm">PC · Brasil · BRL · correspondência pelo título completo</p></div>
        <button disabled={loading} onClick={() => void select(selected)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-violet-50 disabled:opacity-50 sm:ml-auto">Atualizar consulta ↻</button>
      </div>
      {!loading && <>
        <div className="my-6 rounded-2xl border border-violet-200 bg-violet-50 p-6"><span className="text-xs font-bold uppercase tracking-widest text-brand-purple">Veredito SaveMe</span><h3 className="mt-2 font-display text-2xl font-semibold">{comparable ? saving ? `Economize ${money(saving)}` : 'Empate no preço. A escolha é sua.' : 'Comparação incompleta'}</h3><p className="!mb-0 mt-2 text-sm">{comparable ? saving ? `${Math.round(saving / max * 100)}% de diferença entre os preços consultados. A menor oferta está destacada abaixo.` : 'As duas lojas retornaram o mesmo valor para este título.' : 'Precisamos de preços elegíveis nas duas lojas para indicar a melhor oferta.'}</p></div>
        <div className="grid gap-5 md:grid-cols-2">{(['Steam', 'Epic'] as const).map(store => {
          const offer = offers.find(item => item.store === store); const winner = comparable && offer?.price === min;
          return <article key={store} aria-label={`Oferta ${store}`} className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 sm:p-8 ${winner ? 'border-brand-purple shadow-lg shadow-violet-100' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-xl font-semibold">{store === 'Epic' ? 'Epic Games Store' : 'Steam'}</h3>{winner && <span className="rounded-full bg-brand-purple px-3 py-1 text-xs font-bold text-white">{saving ? 'MENOR PREÇO' : 'MESMO PREÇO'}</span>}</div>
            <span className="mt-2 text-xs text-slate-500">Licença digital · PC · Brasil</span>
            <div className="my-7">{offer?.price != null && offer.original != null && offer.original > offer.price && <span className="block text-sm text-slate-400 line-through">{money(offer.original)}</span>}<strong className="font-display text-3xl tracking-tight">{offer?.price == null ? 'Sem preço disponível' : offer.price === 0 ? 'Grátis' : money(offer.price)}</strong></div>
            <p className="!mb-4 text-xs">{offer ? store === 'Epic' ? 'Fonte: EGData · preço registrado para o Brasil.' : 'Fonte: Steam · preço para o Brasil.' : selected[store === 'Steam' ? 'steam' : 'epic'] ? 'A consulta desta loja falhou. Atualize para tentar novamente.' : 'Nenhum título correspondente encontrado nesta busca.'}</p>
            {offer && <div className="mb-5 text-xs leading-6 text-slate-500">Consultado em {date(offer.checked)}{offer.recorded && <div>Registro de preço da fonte: {date(offer.recorded)}</div>}</div>}
            {offer?.link && <a href={offer.link} target="_blank" rel="noopener noreferrer" className={`mt-auto flex items-center justify-between rounded-xl px-5 py-3 text-sm ${winner ? 'bg-brand-purple !text-white' : 'bg-slate-100 !text-night'}`}>Ver {offer.price === null ? 'página' : 'oferta'} na {store} <span aria-hidden="true">↗</span></a>}
          </article>;
        })}</div>
        <p className="mt-5 text-xs">A correspondência usa o título completo; confirme a edição e o conteúdo nas lojas. Os preços podem mudar e a fonte Epic pode ter atraso. Descontos pessoais, cupons e recompensas não entram no cálculo.</p>
      </>}
    </div> : <>
      {!!games.length && <section aria-label="Jogos para comparar" className="mt-6"><h2 className="mb-4 font-display text-xl font-semibold">Escolha seu próximo jogo</h2><ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{games.map(game => <li key={game.key}><button onClick={() => void select(game)} className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg">{game.imagem && <img src={game.imagem} alt="" loading="lazy" className="aspect-video w-full object-cover" />}<span className="flex w-full flex-1 flex-col p-5"><span className="text-xs font-semibold text-slate-500">{[game.steam && 'Steam', game.epic && 'Epic'].filter(Boolean).join(' + ')}</span><span className="mt-2 font-display text-lg font-semibold">{game.nome}</span><span className="mt-5 text-sm font-semibold text-brand-purple">Comparar este título →</span></span></button></li>)}</ul>{more && <p className="mt-4 text-xs">Há mais resultados na Epic. Refine pelo título completo para encontrar a edição desejada.</p>}</section>}
      {!loading && searched && query.trim().length >= 2 && !games.length && <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6">Nenhum título encontrado nesta consulta. Experimente outro nome ou tente novamente.</p>}
      {!searched && <div className="mt-10 grid gap-6 sm:grid-cols-3">{[['01', 'Encontre seu jogo', 'Busque pelo nome e selecione o título e a edição.'], ['02', 'Compare com clareza', 'Preços em reais, fontes e horários da consulta em um só lugar.'], ['03', 'Mais gameplay', 'Escolha sua loja e conclua a compra diretamente por lá.']].map(([step, title, text]) => <div key={step} className="rounded-2xl border border-slate-200 bg-white p-6"><span className="font-display text-sm font-semibold text-violet-500">{step} /</span><h2 className="mt-4 font-display text-lg font-semibold">{title}</h2><p className="!mb-0 mt-2 text-sm">{text}</p></div>)}</div>}
    </>}
  </div>;
}
