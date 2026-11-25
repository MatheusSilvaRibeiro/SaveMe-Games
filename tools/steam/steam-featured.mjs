import { SteamError } from './steam-probe.mjs';
import { readPrice, readPlatforms } from './steam-metadata.mjs';

export async function listarDestaques({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  let payload;
  try {
    const response = await fetchImpl('https://store.steampowered.com/api/featuredcategories/?cc=BR&l=portuguese', { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new SteamError('HTTP_ERROR', `Steam respondeu HTTP ${response.status}.`);
    try { payload = await response.json(); }
    catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw error;
      throw new SteamError('INVALID_RESPONSE', 'Resposta inválida nos destaques da Steam.');
    }
  } catch (error) {
    if (error instanceof SteamError) throw error;
    throw new SteamError(['TimeoutError', 'AbortError'].includes(error.name) ? 'TIMEOUT' : 'NETWORK_ERROR', 'Não foi possível carregar os destaques da Steam.');
  }
  const sections = ['top_sellers', 'specials', 'new_releases'];
  if (!sections.some(key => Array.isArray(payload?.[key]?.items))) throw new SteamError('INVALID_RESPONSE', 'Steam não retornou a lista de destaques.');
  const ids = new Set();
  const items = sections.flatMap(key => Array.isArray(payload?.[key]?.items) ? payload[key].items : []);
  return items.filter(item => {
    if (item?.type !== 0 || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name !== 'string' || !item.name.trim() || ids.has(item.id)) return false;
    ids.add(item.id); return true;
  }).map(item => ({
    appId: item.id, nome: item.name,
    imagem: item.header_image ?? item.large_capsule_image ?? item.small_capsule_image ?? null,
    ...readPrice({ currency: item.currency, initial: item.original_price, final: item.final_price }),
    sistemas: readPlatforms({ windows: item.windows_available, mac: item.mac_available, linux: item.linux_available }),
    link: `https://store.steampowered.com/app/${item.id}/`,
    metacritic: null,
  }));
}
