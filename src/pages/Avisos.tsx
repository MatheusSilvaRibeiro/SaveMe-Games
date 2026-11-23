import { useEffect, useRef, useState } from 'react';
import { AlertsSessionError, listAlerts, readAlert, type PriceAlert } from '../services/alerts';
import { useSessionReady, useUser } from '../services/auth';

const dates = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

function UserAlerts() {
  const [items, setItems] = useState<PriceAlert[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [before, setBefore] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [pending, setPending] = useState<string>();
  const [expired, setExpired] = useState(false);
  const readRequest = useRef<AbortController | null>(null);
  useEffect(() => () => readRequest.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listAlerts(controller.signal, before).then(result => {
      if (controller.signal.aborted) return;
      setItems(previous => before ? [...previous, ...result.items] : result.items);
      setNext(result.nextCursor);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof AlertsSessionError) setExpired(true);
      else setError('Não foi possível carregar os avisos.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [before, retry]);

  async function markRead(id: string) {
    const controller = new AbortController();
    readRequest.current = controller;
    setPending(id);
    setReadError('');
    try {
      await readAlert(id, controller.signal);
      if (!controller.signal.aborted) {
        setItems(previous => previous.map(alert => alert.id === id ? { ...alert, readAt: new Date().toISOString() } : alert));
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AlertsSessionError) setExpired(true);
      else setReadError('Não foi possível marcar o aviso como lido. Tente novamente.');
    } finally {
      if (!controller.signal.aborted) setPending(undefined);
    }
  }

  if (expired) return <p>Sua sessão expirou. <a href="#/login">Ir para o login</a></p>;
  return <>
    {loading && <p role="status">Carregando avisos…</p>}
    {error && <div>
      <p role="alert" className="!text-red-800">{error}</p>
      <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-lg border px-4 py-2">Tentar novamente</button>
    </div>}
    {readError && <p role="alert" className="!text-red-800">{readError}</p>}
    {!loading && !error && !items.length && <p>Você ainda não tem avisos de queda de preço. <a href="#/favoritos">Ver favoritos</a></p>}
    {items.length > 0 && <ul aria-label="Avisos de queda de preço" className="mt-6 space-y-4">
      {items.map(alert => {
        const store = alert.store === 'steam' ? 'Steam' : 'Epic Games Store';
        const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: alert.currency });
        return <li key={alert.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{alert.gameName}</h2>
            {!alert.readAt && <span className="text-sm font-semibold text-brand-purple">Não lido</span>}
          </div>
          <p className="mt-2">{store} · De {money.format(alert.previousPriceCents / 100)} para {money.format(alert.newPriceCents / 100)}</p>
          <p className="text-sm">Consultado em <time dateTime={alert.observedAt}>{dates.format(new Date(alert.observedAt))}</time> (horário de Brasília).</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`#/comparacao/${encodeURIComponent(alert.gameId)}`}>Ver comparação</a>
            <a href={alert.storeUrl} target="_blank" rel="noopener noreferrer">Ver na loja</a>
            {!alert.readAt && <button type="button" disabled={pending !== undefined}
              onClick={() => void markRead(alert.id)} className="rounded-lg border px-3 py-2">
              {pending === alert.id ? 'Marcando…' : 'Marcar como lido'}
            </button>}
          </div>
        </li>;
      })}
    </ul>}
    {next && !error && <button type="button" disabled={loading} onClick={() => setBefore(next)} className="mt-5 rounded-lg border px-4 py-2">
      Carregar mais avisos
    </button>}
  </>;
}

export function Avisos() {
  const user = useUser();
  const ready = useSessionReady();
  return <>
    <h1>Avisos de preço</h1>
    {!ready ? <p role="status">Verificando sua sessão…</p> : user ? <UserAlerts key={user.id} />
      : <p>Entre na sua conta para ver seus avisos. <a href="#/login">Ir para o login</a></p>}
  </>;
}
