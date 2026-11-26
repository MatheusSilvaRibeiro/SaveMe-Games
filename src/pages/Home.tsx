import { useState, type FormEvent } from 'react';
import { Descobrir } from './Descobrir';
export function Home() {
  const [query, setQuery] = useState('');
  function search(event: FormEvent) { event.preventDefault(); if (query.trim()) location.hash = `/busca?q=${encodeURIComponent(query.trim())}`; }
  return <>
    <section aria-labelledby="home-title" className="relative overflow-hidden rounded-3xl bg-night bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-purple),transparent_65%)] px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-80 rounded-full border-[48px] border-white/5" />
      <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold !text-violet-100">PC GAMING &middot; STEAM + EPIC</p>
      <h1 id="home-title" className="relative max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl">Mais tempo jogando.<span className="block text-violet-200">Menos tempo pesquisando.</span></h1>
      <p className="mb-8 mt-5 max-w-xl text-base !text-slate-200 sm:text-lg">Descubra seu pr&oacute;ximo jogo, encontre ofertas e acompanhe os pre&ccedil;os. Sua pr&oacute;xima jogatina come&ccedil;a com uma boa escolha.</p>
      <form onSubmit={search} role="search" aria-label="Buscar um jogo" className="relative flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 sm:flex-row">
        <label htmlFor="home-search" className="sr-only">Qual jogo voc&ecirc; quer jogar?</label><input id="home-search" type="search" value={query} onChange={e => setQuery(e.target.value)} required minLength={2} maxLength={100} placeholder="Qual jogo voc&ecirc; quer jogar?" className="min-h-12 min-w-0 flex-1 rounded-xl border-0 bg-white px-4 text-base text-night" />
        <button className="min-h-12 rounded-xl bg-brand-purple px-6 font-semibold text-white hover:bg-violet-900">Buscar jogos &rarr;</button>
      </form>
      <div className="mt-5 flex flex-wrap gap-4 text-sm"><a href="#/descobrir" className="!text-violet-100">Ainda n&atilde;o sei o que jogar &rarr;</a><a href="#/comparacao" className="!text-violet-100">Quero comparar pre&ccedil;os &rarr;</a></div>
    </section>
    <section aria-label="Escolha por onde comecar" className="mt-8 grid gap-4 md:grid-cols-3">
      {[
        { title: 'Jogatina sem estourar o bolso', text: 'Ajuste seu limite e encontre destaques dentro do seu or\u00e7amento.', link: '#/descobrir?budget=50', tag: 'AT\u00c9 R$ 50', action: 'Encontrar meu pr\u00f3ximo jogo' },
        { title: 'O que est\u00e1 chamando aten\u00e7\u00e3o?', text: 'Explore os t\u00edtulos presentes nos mais vendidos da Steam.', link: '#/descobrir?section=top_sellers', tag: 'MAIS VENDIDOS NA STEAM', action: 'Explorar os destaques' },
        { title: 'Gostou? Acompanhe o pre\u00e7o.', text: 'Favorite um jogo da compara\u00e7\u00e3o e receba avisos no site quando o pre\u00e7o cair.', link: '#/favoritos', tag: 'SUA LISTA, SUAS ESCOLHAS', action: 'Ver meus favoritos' },
      ].map(item => <a key={item.title} href={item.link} className="group rounded-2xl border border-slate-200 bg-white p-6 !text-night shadow-sm transition hover:border-violet-300 hover:no-underline hover:shadow-md"><span className="text-[11px] font-bold tracking-wider text-brand-purple">{item.tag}</span><h2 className="mt-3 font-display text-xl font-semibold">{item.title}</h2><p className="mt-3 !mb-4 text-sm">{item.text}</p><span className="text-sm font-semibold text-brand-purple">{item.action} &rarr;</span></a>)}
    </section>
    <Descobrir preview />
    <section className="mt-16 grid gap-8 rounded-3xl bg-violet-50 p-7 sm:p-10 lg:grid-cols-2">
      <div><p className="!mb-2 text-xs font-bold tracking-widest !text-brand-purple">COMPRE COM MAIS CONTEXTO</p><h2 className="font-display text-3xl font-semibold">Uma oferta faz mais sentido quando voc&ecirc; pode comparar.</h2><p className="mt-4">Veja os pre&ccedil;os da mesma edi&ccedil;&atilde;o na Steam e na Epic, confira o hist&oacute;rico coletado e decida se &eacute; hora de comprar ou acompanhar.</p><a href="#/comparacao" className="inline-flex min-h-11 items-center rounded-xl bg-brand-purple px-5 py-3 text-sm font-semibold !text-white">Escolher um jogo para comparar &rarr;</a></div>
      <ol className="space-y-4">{[['01', 'Compare a mesma edi\u00e7\u00e3o', 'A compara\u00e7\u00e3o est\u00e1 dispon\u00edvel nos jogos associados e conferidos nas duas lojas.'], ['02', 'Entenda a varia\u00e7\u00e3o', 'Veja como os pre\u00e7os mudaram nas consultas registradas.'], ['03', 'Acompanhe sem pesquisar de novo', 'Favorite e consulte os avisos de queda dentro da sua conta.']].map(([number, title, text]) => <li key={number} className="flex gap-4 rounded-2xl bg-white p-5"><span className="font-display text-2xl font-bold text-violet-300">{number}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 !mb-0 text-sm">{text}</p></div></li>)}</ol>
    </section>
  </>;
}
