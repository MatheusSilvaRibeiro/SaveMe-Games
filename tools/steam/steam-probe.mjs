// Investigação isolada: não é o backend NestJS nem uma busca por nome.
import { pathToFileURL } from 'node:url';
import { readPrice, readScore, readPlatforms } from './steam-metadata.mjs';

export class SteamError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function consultarJogo(appId, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!/^\d+$/.test(String(appId)) || !Number.isSafeInteger(Number(appId)) || Number(appId) <= 0) {
    throw new SteamError('INVALID_ID', 'Informe um AppID inteiro positivo.');
  }
  const id = String(Number(appId));
  const url = new URL('https://store.steampowered.com/api/appdetails');
  url.search = new URLSearchParams({ appids: id, cc: 'br', l: 'portuguese' }).toString();
  let response;
  let payload;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new SteamError('HTTP_ERROR', `Steam respondeu HTTP ${response.status}.`);
    try { payload = await response.json(); }
    catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw error;
      throw new SteamError('INVALID_RESPONSE', 'Steam retornou uma resposta que não é JSON válido.');
    }
  } catch (error) {
    if (error instanceof SteamError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new SteamError('TIMEOUT', 'Tempo de espera pela Steam esgotado.');
    }
    throw new SteamError('NETWORK_ERROR', 'Não foi possível conectar à Steam.');
  }
  const item = payload?.[id];
  // success:false não informa se o ID inexiste ou está indisponível na região.
  if (item?.success === false) throw new SteamError('UNAVAILABLE', 'Jogo não encontrado ou indisponível nesta consulta.');
  const data = item?.data;
  if (item?.success !== true || !data || data.steam_appid !== Number(id) || typeof data.name !== 'string') {
    throw new SteamError('INVALID_RESPONSE', 'Resposta sem os dados esperados para o jogo.');
  }
  const price = data.price_overview;
  const validPrice = price?.currency === 'BRL' && Number.isSafeInteger(price.final) && price.final >= 0;
  // Preço ausente não é zero. Gratuito só quando a fonte informa is_free.
  const priceCents = validPrice ? price.final : data.is_free === true ? 0 : null;
  return {
    appId: Number(id), nome: data.name, tipo: data.type ?? null,
    imagem: data.header_image ?? null, loja: 'Steam', regiao: 'BR',
    metacritic: readScore(data.metacritic?.score),
    sistemas: readPlatforms(data.platforms),
    generos: Array.isArray(data.genres) ? data.genres.map(genre => genre?.description).filter(value => typeof value === 'string' && value.trim()) : [],
    desenvolvedoras: Array.isArray(data.developers) ? data.developers.filter(value => typeof value === 'string' && value.trim()) : [],
    lancamento: typeof data.release_date?.date === 'string' && data.release_date.date.trim() ? data.release_date.date : null,
    emBreve: data.release_date?.coming_soon === true,
    precoOriginalCentavos: readPrice(price).precoOriginalCentavos,
    descontoPercentual: readPrice(price).descontoPercentual,
    moeda: priceCents === null ? null : 'BRL', precoCentavos: priceCents,
    situacaoPreco: priceCents === null ? 'indisponivel' : data.is_free === true ? 'gratuito' : 'informado',
    link: `https://store.steampowered.com/app/${id}/`,
    consultadoEm: new Date().toISOString(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await consultarJogo(process.argv[2] ?? '620'), null, 2)); }
  catch (error) { console.error(`${error.code ?? 'ERROR'}: ${error.message}`); process.exitCode = 1; }
}
