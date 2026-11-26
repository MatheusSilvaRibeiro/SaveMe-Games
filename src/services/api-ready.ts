export const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
type State = 'idle' | 'starting' | 'error';
let state: State = 'idle';
let readyAt = 0;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
function setState(value: State) { state = value; listeners.forEach(listener => listener()); }
export const apiState = () => state;
export function subscribeApi(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export async function waitForApi(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (Date.now() - readyAt < 60000) return;
  if (!pending) {
    const notice = setTimeout(() => setState('starting'), 1000);
    pending = (async () => {
      try {
        const deadline = AbortSignal.timeout(90000);
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await fetch(`${apiBase}/health`, { signal: deadline, cache: 'no-store' });
          if (!response.ok) {
            if ([502, 503, 504].includes(response.status) && attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            throw new Error('Servidor indisponivel. Tente novamente em instantes.');
          }
          const health = await response.json();
          if (health.service !== 'saveme-api' || health.status !== 'ok') throw new Error('Resposta inesperada do servidor.');
          readyAt = Date.now();
          setState('idle');
          return;
        }
      } catch {
        setState('error');
        throw new Error('O servidor demorou para iniciar. Tente novamente em instantes.');
      } finally {
        clearTimeout(notice);
        pending = undefined;
      }
    })();
  }
  // Cancelar uma tela nao cancela a inicializacao compartilhada por outras telas.
  await pending;
  signal?.throwIfAborted();
}
