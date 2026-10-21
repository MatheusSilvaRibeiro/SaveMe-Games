import { pathToFileURL } from 'node:url';
import { EpicError, normalizarOfertaEpic } from './epic-probe.mjs';

async function readResource(path, { fetchImpl, timeoutMs }, priceResource = false) {
  try {
    const response = await fetchImpl(`https://api.egdata.app${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.status === 404 && priceResource) return null;
    if (response.status === 404) throw new EpicError('UNAVAILABLE', 'Oferta não encontrada na fonte.');
    if (!response.ok) throw new EpicError(response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR', `EGData respondeu HTTP ${response.status}.`);
    try { return await response.json(); }
    catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw error;
      throw new EpicError('INVALID_RESPONSE', 'EGData retornou JSON inválido.');
    }
  } catch (error) {
    if (error instanceof EpicError) throw error;
    throw new EpicError(['TimeoutError', 'AbortError'].includes(error.name) ? 'TIMEOUT' : 'NETWORK_ERROR', 'Não foi possível consultar a oferta da Epic.');
  }
}

export async function consultarOfertaEpic(offerId, { fetchImpl = fetch, timeoutMs = 10000, namespaceEsperado } = {}) {
  if (typeof offerId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(offerId)) {
    throw new EpicError('INVALID_ID', 'Identificador de oferta inválido.');
  }
  const options = { fetchImpl, timeoutMs };
  const offer = await readResource(`/offers/${offerId}?country=BR&locale=pt-BR`, options);
  if (!offer || offer.id !== offerId || typeof offer.namespace !== 'string' || !offer.namespace || typeof offer.title !== 'string' || !offer.title.trim()) {
    throw new EpicError('INVALID_RESPONSE', 'Resposta não corresponde à oferta solicitada.');
  }
  if (namespaceEsperado && namespaceEsperado !== offer.namespace) throw new EpicError('INVALID_RESPONSE', 'A identidade do produto não corresponde ao esperado.');
  if (offer.offerType !== 'BASE_GAME') throw new EpicError('INCOMPATIBLE_OFFER', 'A oferta selecionada não é um jogo base.');
  const price = await readResource(`/offers/${offerId}/price?country=BR`, options, true);
  if (price !== null && (price.offerId !== offerId || price.namespace !== offer.namespace)) {
    throw new EpicError('INVALID_RESPONSE', 'O registro de preço não pertence à oferta solicitada.');
  }
  return normalizarOfertaEpic({ ...offer, price });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await consultarOfertaEpic(process.argv[2] ?? '2ae6edb2223c4f8c97e9839b5b6497bb'), null, 2)); }
  catch (error) { console.error(`${error.code ?? 'ERROR'}: ${error.message}`); process.exitCode = 1; }
}
