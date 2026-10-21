import { useSyncExternalStore } from 'react';

export interface User { id: string; name: string; email: string; }
let user: User | null = null;
const listeners = new Set<() => void>();
let initialized = false;
let revision = 0;
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
function update(value: User | null) { revision++; user = value; listeners.forEach(listener => listener()); }
async function request(path: string, body?: unknown) {
  try {
    const response = await fetch(`${base}/auth/${path}`, {
      credentials: 'include', method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(response.status >= 500 ? 'Não foi possível acessar sua conta agora. Tente novamente em instantes.' : data.message || 'Não foi possível concluir a solicitação.');
    return data;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof DOMException) throw new Error('Não foi possível conectar ao serviço de contas. Tente novamente.');
    throw error;
  }
}
export async function authenticate(mode: 'login' | 'cadastro', data: { email: string; password: string; name?: string }) {
  const result = await request(mode === 'cadastro' ? 'register' : 'login', data);
  update(result.user);
}
export async function logout() { await request('logout', {}); update(null); }
export function useUser() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => user);
}
export async function restoreSession() {
  if (initialized) return;
  initialized = true;
  const initialRevision = revision;
  try {
    const result = await request('me');
    if (revision === initialRevision) update(result.user);
  } catch { if (revision === initialRevision) update(null); }
}
