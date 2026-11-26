import { apiBase, waitForApi } from './api-ready';
export interface Preferences { priceAlertsEnabled: boolean; }
export async function preferences(signal: AbortSignal, value?: boolean): Promise<Preferences> {
  await waitForApi(signal);
  const response = await fetch(`${apiBase}/preferences`, {
    credentials: 'include', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    ...(value === undefined ? {} : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceAlertsEnabled: value }) }),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Entre na sua conta para continuar.' : 'Falha ao acessar suas preferencias. Tente novamente.');
  const data = await response.json();
  if (typeof data?.priceAlertsEnabled !== 'boolean') throw new Error('Resposta invalida do servidor.');
  return data;
}
