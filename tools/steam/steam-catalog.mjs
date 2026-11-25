import { consultarJogo, SteamError } from './steam-probe.mjs';

import { listarDestaques } from './steam-featured.mjs';
export const PAGE_SIZE = 12;

// Cache curto de dados públicos em memória. Não é histórico persistente de preços.
export function createCatalog({ lookup = consultarJogo, list = listarDestaques, ttlMs = 300000, maxEntries = 100, now = Date.now } = {}) {
  let listing = null;
  let listingPending = null;
  const cache = new Map();
  const pending = new Map();
  const queue = [];
  let active = 0;

  async function limited(operation) {
    if (active >= 3) await new Promise(resolve => queue.push(resolve));
    else active++;
    try { return await operation(); }
    finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  }

  async function details(appId) {
    const id = String(appId);
    const stored = cache.get(id);
    if (stored && stored.expires > now()) return stored.value;
    if (pending.has(id)) return pending.get(id);
    const promise = limited(async () => {
      const value = await lookup(id, { timeoutMs: 2500 });
      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(id, { value, expires: now() + ttlMs });
      return value;
    });
    pending.set(id, promise);
    try { return await promise; }
    finally { pending.delete(id); }
  }

  async function enrich(response) {
    const items = await Promise.all(response.resultados.slice(0, 12).map(async item => {
      try { return { ...item, ...await details(item.appId) }; }
      catch {
        // Falha nos detalhes não elimina o resultado nem transforma ausência em grátis.
        return { ...item, tipo: null, generos: [], situacaoPreco: item.precoCentavos == null ? 'indisponivel' : 'informado' };
      }
    }));
    return { ...response, resultados: items };
  }

  async function featured(page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new SteamError('INVALID_QUERY', 'Página inválida.');
    if (!listing || listing.expires <= now()) {
      if (!listingPending) listingPending = Promise.resolve().then(() => list()).then(items => {
        listing = { items, expires: now() + ttlMs }; return listing;
      }).finally(() => { listingPending = null; });
      await listingPending;
    }
    const start = (page - 1) * PAGE_SIZE;
    const items = listing.items.slice(start, start + PAGE_SIZE);
    const response = await enrich({ termo: '', regiao: 'BR', resultados: items });
    return { ...response, pagina: page, total: listing.items.length, proximaPagina: start + PAGE_SIZE < listing.items.length ? page + 1 : null };
  }
  return { details, enrich, featured };
}
