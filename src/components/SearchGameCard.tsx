import { useState } from 'react';

export const cardStyle = 'flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-violet-300 hover:shadow-md';
export const cardBodyStyle = 'flex w-full flex-1 flex-col p-5 text-left';
export const cardStoreStyle = 'block text-xs font-semibold uppercase tracking-wider text-brand-purple';
export const cardTitleStyle = 'mt-2 block font-display text-lg font-semibold leading-snug';
export const cardPriceStyle = 'mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4';
export const cardActionStyle = 'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold !text-white hover:bg-violet-900';

export function SearchGameArtwork({ src }: { src?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return <span className="relative flex aspect-[231/87] w-full items-center justify-center overflow-hidden bg-violet-50">
    {!loaded && <span aria-hidden="true" className="font-display text-lg font-semibold text-brand-purple">SaveMe Games</span>}
    {src && <img src={src} alt="" loading="lazy" onLoad={() => setLoaded(true)} className={`absolute inset-0 h-full w-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
  </span>;
}
