import { buscarOfertasEpic, listarOfertasEpic } from './epic-probe.mjs';
import { consultarOfertaEpic } from './epic-details.mjs';

export function createEpicCatalog({ search = buscarOfertasEpic, list = listarOfertasEpic, details = consultarOfertaEpic, now = Date.now, ttlMs = 300000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function load(term, options = {}) {
    const key = JSON.stringify([term, options.page ?? 1]);
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.value;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      const data = await (term === null ? list(options) : search(term, options));
      const eligible = data.resultados.filter(item => !item.somenteMobile && !['fora_regiao', 'resgate_codigo'].includes(item.disponibilidade));
      // Recupera no máximo quatro registros incompletos, com duas consultas simultâneas.
      const incomplete = eligible.filter(item => !item.link || item.disponibilidade === 'sem_preco').slice(0, 4);
      const hydrated = new Map();
      for (let i = 0; i < incomplete.length; i += 2) {
        await Promise.all(incomplete.slice(i, i + 2).map(async item => {
          try {
            const result = await details(item.id, { namespaceEsperado: item.namespace, timeoutMs: 2000 });
            if (result.id === item.id && result.namespace === item.namespace) hydrated.set(item.id, result);
          } catch { /* Preserva o resultado parcial; uma falha não invalida os demais jogos. */ }
        }));
      }
      const resolved = eligible.map(item => hydrated.get(item.id) ?? item)
        .filter(item => !item.somenteMobile && !['fora_regiao', 'resgate_codigo'].includes(item.disponibilidade));
      const value = { ...data, resultados: term === null ? resolved.filter(item => item.disponibilidade === 'disponivel' && item.link && item.precoCentavos !== null) : resolved };
      cache.set(key, { value, expires: now() + ttlMs });
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      return value;
    })();
    pending.set(key, operation);
    try { return await operation; } finally { pending.delete(key); }
  }
  return { search: (term, options) => load(term, options), list: options => load(null, options), details };
}
