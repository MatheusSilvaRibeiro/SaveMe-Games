// Prova de busca na loja, ainda sem garantia de cobertura ou estabilidade da fonte.
import { pathToFileURL } from 'node:url';
import { SteamError } from './steam-probe.mjs';
import { readPrice, readScore, readPlatforms } from './steam-metadata.mjs';

export async function buscarJogos(term, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (typeof term !== 'string' || term.trim().length < 2 || term.trim().length > 100) {
    throw new SteamError('INVALID_QUERY', 'Digite entre 2 e 100 caracteres.');
  }
  const url = new URL('https://store.steampowered.com/api/storesearch/');
  url.search = new URLSearchParams({ term: term.trim(), cc: 'BR', l: 'portuguese' }).toString();
  let payload;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new SteamError('HTTP_ERROR', `Steam respondeu HTTP ${response.status}.`);
    try { payload = await response.json(); }
    catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw error;
      throw new SteamError('INVALID_RESPONSE', 'Resposta da busca não é JSON válido.');
    }
  } catch (error) {
    if (error instanceof SteamError) throw error;
    if (['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new SteamError('TIMEOUT', 'Tempo de espera pela busca esgotado.');
    }
    throw new SteamError('NETWORK_ERROR', 'Não foi possível conectar à Steam.');
  }
  if (!payload || !Array.isArray(payload.items)) {
    throw new SteamError('INVALID_RESPONSE', 'Resposta da busca sem lista de resultados.');
  }
  const apps = payload.items.filter(item => item?.type === 'app');
  if (apps.some(item => !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name !== 'string' || !item.name.trim())) {
    throw new SteamError('INVALID_RESPONSE', 'Resultado sem identificador ou nome válido.');
  }
  const ids = new Set();
  return {
    termo: term.trim(), regiao: 'BR', consultadoEm: new Date().toISOString(),
    // 'app' também pode representar DLC/trilha sonora: confirmar o tipo nos detalhes.
    resultados: apps.filter(item => {
      if (ids.has(item.id)) return false;
      ids.add(item.id); return true;
    }).map(item => ({
      appId: item.id, nome: item.name, imagem: item.tiny_image ?? null,
      ...readPrice(item.price),
      metacritic: readScore(item.metascore),
      sistemas: readPlatforms(item.platforms),
      link: `https://store.steampowered.com/app/${item.id}/`,
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await buscarJogos(process.argv.slice(2).join(' ')), null, 2)); }
  catch (error) { console.error(`${error.code ?? 'ERROR'}: ${error.message}`); process.exitCode = 1; }
}
