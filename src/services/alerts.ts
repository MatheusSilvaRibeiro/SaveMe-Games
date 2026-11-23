export interface PriceAlert {
  id: string;
  gameId: string;
  gameName: string;
  store: 'steam' | 'epic';
  storeUrl: string;
  region: string;
  currency: string;
  previousPriceCents: number;
  newPriceCents: number;
  observedAt: string;
  readAt: string | null;
}

const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const unreadAlertsChanged = 'saveme:unread-alerts-changed';
export class AlertsSessionError extends Error {}

async function request(path: string, signal: AbortSignal, write = false) {
  const response = await fetch(`${base}/alerts${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    credentials: 'include',
    ...(write ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
  });
  if (response.status === 401) throw new AlertsSessionError();
  if (!response.ok) throw new Error('Falha ao acessar avisos.');
  return response;
}

export async function listAlerts(signal: AbortSignal, before?: string) {
  const response = await request(before ? `?before=${encodeURIComponent(before)}` : '', signal);
  return await response.json() as { items: PriceAlert[]; nextCursor: string | null };
}

export async function getUnreadAlerts(signal: AbortSignal) {
  const response = await request('/unread', signal);
  return (await response.json() as { count: number }).count;
}

export async function readAlert(id: string, signal: AbortSignal) {
  await request(`/${encodeURIComponent(id)}/read`, signal, true);
  window.dispatchEvent(new Event(unreadAlertsChanged));
}
