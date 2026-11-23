import { useEffect, useState } from 'react';
import { request } from '../services/steam';

type Store = 'steam' | 'epic';
type Point = {
  collectedAt: string;
  priceCents: number | null;
  state: 'available' | 'price_missing' | 'unavailable';
};
type History = {
  since: string;
  until: string;
  series: { store: Store; points: Point[] }[];
};

const stores = {
  steam: { label: 'Steam', color: '#1d4ed8' },
  epic: { label: 'Epic Games Store', color: '#9d174d' },
};
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

function priceLabel(point: Point) {
  if (point.priceCents !== null) return money.format(point.priceCents / 100);
  return point.state === 'unavailable' ? 'Oferta indisponível' : 'Preço não informado';
}

function HistoryChart({ history }: { history: History }) {
  const max = Math.max(0, ...history.series.flatMap(series => series.points.map(point => point.priceCents ?? 0)));
  const step = Math.max(100, Math.ceil(max / 400) * 100);
  const since = Date.parse(history.since);
  const until = Date.parse(history.until);
  const x = (value: number) => 86 + (value - since) / (until - since) * 524;
  const y = (price: number) => 190 - price / (step * 4) * 164;

  return <figure className="my-4">
    <svg viewBox="0 0 640 232" role="img" aria-label="Histórico de preços em reais por loja, com pontos nas consultas que têm preço"
      className="w-full max-w-4xl">
      {[0, 1, 2, 3, 4].map(level => <g key={level}>
        <line x1="86" x2="610" y1={y(level * step)} y2={y(level * step)} stroke="#cbd5e1" />
        <text x="80" y={y(level * step) + 4} textAnchor="end" fontSize="12">{money.format(level * step / 100)}</text>
      </g>)}
      {[0, 0.5, 1].map(position => {
        const time = since + (until - since) * position;
        return <text key={position} x={x(time)} y="213" textAnchor={position === 0 ? 'start' : position === 1 ? 'end' : 'middle'}
          fontSize="13">{date.format(time)}</text>;
      })}
      {history.series.flatMap(({ store, points }) => points.flatMap(point => {
        if (point.priceCents === null) return [];
        const label = `${stores[store].label} · ${dateTime.format(new Date(point.collectedAt))} · ${priceLabel(point)}`;
        const px = x(Date.parse(point.collectedAt));
        const py = y(point.priceCents);
        const color = stores[store].color;
        return store === 'steam'
          ? [<circle key={`${store}-${point.collectedAt}`} cx={px} cy={py} r="4" fill={color}><title>{label}</title></circle>]
          : [<rect key={`${store}-${point.collectedAt}`} x={px - 4} y={py - 4} width="8" height="8" fill="none" stroke={color} strokeWidth="2"><title>{label}</title></rect>];
      }))}
    </svg>
    <figcaption className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {history.series.map(({ store }) => <span key={store} className="font-semibold" style={{ color: stores[store].color }}>
        <span aria-hidden="true">{store === 'steam' ? '●' : '□'} </span>{stores[store].label}
      </span>)}
      <span>Datas no horário de Brasília.</span>
    </figcaption>
  </figure>;
}

export function PriceHistory({ gameId }: { gameId: string }) {
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState<History>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setHistory(undefined);
    setError(false);
    void request<History>(`/comparisons/history/${encodeURIComponent(gameId)}?days=${days}`, controller.signal)
      .then(data => { if (!controller.signal.aborted) setHistory(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [gameId, days, retry]);

  const points = history?.series.flatMap(series => series.points) ?? [];
  return <section aria-labelledby="price-history-title" className="my-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="price-history-title" className="text-xl font-semibold">Histórico de preços</h2>
      <label className="flex items-center gap-2 text-sm">
        Período
        <select value={days} onChange={event => setDays(Number(event.target.value))} className="rounded-lg border border-slate-300 p-2">
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </select>
      </label>
    </div>
    {error ? <div className="mt-3">
      <p role="alert" className="!text-red-800">Não foi possível carregar o histórico de preços.</p>
      <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-lg border border-slate-300 px-4 py-2">Recarregar histórico</button>
    </div> : !history ? <p role="status" className="mt-3">Carregando histórico de preços…</p>
      : !points.length ? <p className="mt-3">Ainda não há observações neste período.</p>
      : <>
        {points.some(point => point.priceCents !== null) ? <HistoryChart history={history} />
          : <p className="mt-3">Há consultas neste período, mas nenhuma informou preço.</p>}
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold">Ver observações por loja</summary>
          {history.series.map(({ store, points: entries }) => <div key={store} className="mt-4">
            <h3 className="text-sm font-semibold">{stores[store].label}</h3>
            {entries.length ? <ul className="mt-2 space-y-1 text-sm">
              {entries.map(point => <li key={point.collectedAt}>
                <time dateTime={point.collectedAt}>{dateTime.format(new Date(point.collectedAt))}</time> · {priceLabel(point)}
              </li>)}
            </ul> : <p className="text-sm">Sem observações.</p>}
          </div>)}
        </details>
      </>}
  </section>;
}
