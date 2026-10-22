// Investigação de ofertas da Epic via EGData, serviço de terceiros.
// Não faz associação automática com jogos/edições da Steam.
import { pathToFileURL } from 'node:url';

export class EpicError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function offerLink(offer) {
  const mapping = Array.isArray(offer.offerMappings) ? offer.offerMappings.find(item => ['offer', 'productHome'].includes(item?.pageType))?.pageSlug : null;
  for (const candidate of [offer.productSlug, offer.customAttributes?.['com.epicgames.app.productSlug']?.value, mapping]) {
    const raw = typeof candidate === 'string' ? candidate.replace(/\/home$/, '') : '';
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(raw)) return `https://store.epicgames.com/pt-BR/p/${raw}`;
  }
  return null;
}

export function normalizarOfertaEpic(offer, consulted = new Date().toISOString()) {
  const priceRecord = offer.price;
  const price = priceRecord?.price;
  const countryMatches = !priceRecord?.country || priceRecord.country === 'BR';
  const valid = countryMatches && price?.currencyCode === 'BRL' && Number.isSafeInteger(price.discountPrice) && price.discountPrice >= 0;
  const release = offer.effectiveDate ?? offer.releaseDate;
  const upcoming = typeof release === 'string' && Date.parse(release) > Date.parse(consulted);
  const regionAllowed = !offer.countriesBlacklist?.includes('BR') && (!Array.isArray(offer.countriesWhitelist) || !offer.countriesWhitelist.length || offer.countriesWhitelist.includes('BR'));
  const cents = valid && regionAllowed && (!upcoming || offer.prePurchase === true) && !offer.isCodeRedemptionOnly ? price.discountPrice : null;
  const genreIds = new Set(['1216','1218','1210','1263','1367','1258','1083','1296','1298','1302','1393','1283','1336']);
  const updated = priceRecord?.updatedAt;
  const systems = Array.isArray(offer.tags) ? offer.tags.filter(tag => ['9547', '10719', '39070', '39071'].includes(tag?.id)).map(tag => ({ '9547': 'Windows', '10719': 'macOS', '39070': 'iOS', '39071': 'Android' })[tag.id]) : [];
  const mobileOnly = systems.some(system => ['iOS', 'Android'].includes(system)) && !systems.some(system => ['Windows', 'macOS'].includes(system));
  const disponibilidade = !regionAllowed ? 'fora_regiao' : offer.isCodeRedemptionOnly ? 'resgate_codigo' : upcoming && offer.prePurchase !== true ? 'em_breve' : cents === null ? 'sem_preco' : 'disponivel';
  const original = cents !== null && Number.isSafeInteger(price.originalPrice) && price.originalPrice > cents ? price.originalPrice : null;
  return {
    imagem: Array.isArray(offer.keyImages) ? offer.keyImages.find(item => ['OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail'].includes(item?.type) && /^https:\/\//.test(item?.url))?.url ?? null : null,
    id: offer.id, namespace: offer.namespace, nome: offer.title, tipoOferta: offer.offerType,
    disponibilidade, somenteMobile: mobileOnly, sistemas: systems,
    precoOriginalCentavos: original, descontoPercentual: original !== null ? Math.round((1 - cents / original) * 100) : null,
    emBreve: upcoming && offer.prePurchase !== true,
    generos: Array.isArray(offer.tags) ? offer.tags.filter(tag => genreIds.has(tag?.id) && typeof tag?.name === 'string').map(tag => tag.name) : [],
    loja: 'Epic Games Store', fonte: 'EGData', regiao: 'BR',
    precoCentavos: cents, moeda: valid ? 'BRL' : null,
    situacaoPreco: cents === null ? 'indisponivel' : cents === 0 ? 'gratuito_nesta_oferta' : 'informado',
    link: offerLink(offer),
    // Data do registro na fonte; não é prova de verificação atual do preço na Epic.
    registroPrecoEm: typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? updated : null,
    consultadoEm: consulted,
  };
}

async function consultarCatalogoEpic(term, { fetchImpl = fetch, timeoutMs = 10000, page = 1 } = {}) {
  if (term !== null && (typeof term !== 'string' || term.trim().length < 2 || term.trim().length > 100)) {
    throw new EpicError('INVALID_QUERY', 'Digite entre 2 e 100 caracteres.');
  }
  if (!Number.isSafeInteger(page) || page < 1) throw new EpicError('INVALID_QUERY', 'Página inválida.');
  let payload;
  try {
    const response = await fetchImpl('https://api.egdata.app/search/v2/search?country=BR&locale=pt-BR', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(term === null ? { sortBy: 'releaseDate', sortDir: 'desc' } : { title: term.trim() }), offerType: 'BASE_GAME', page, limit: 12 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new EpicError(response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR', `EGData respondeu HTTP ${response.status}.`);
    try { payload = await response.json(); }
    catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw error;
      throw new EpicError('INVALID_RESPONSE', 'EGData retornou JSON inválido.');
    }
  } catch (error) {
    if (error instanceof EpicError) throw error;
    throw new EpicError(['TimeoutError', 'AbortError'].includes(error.name) ? 'TIMEOUT' : 'NETWORK_ERROR', 'Não foi possível consultar a fonte de ofertas da Epic.');
  }
  if (!payload || !Array.isArray(payload.offers)) throw new EpicError('INVALID_RESPONSE', 'Resposta sem lista de ofertas.');
  const offers = payload.offers.filter(offer => offer?.offerType === 'BASE_GAME');
  if (offers.some(offer => typeof offer.id !== 'string' || !offer.id || typeof offer.namespace !== 'string' || !offer.namespace || typeof offer.title !== 'string' || !offer.title.trim())) {
    throw new EpicError('INVALID_RESPONSE', 'Oferta sem identidade ou título válido.');
  }
  const consulted = new Date().toISOString();
  const seen = new Set();
  return {
    termo: term?.trim() ?? '', pagina: page, proximaPagina: Number.isSafeInteger(payload.total) && page * 12 < payload.total ? page + 1 : null, loja: 'Epic Games Store', fonte: 'EGData', regiao: 'BR', consultadoEm: consulted,
    resultados: offers.filter(offer => {
      const key = `${offer.namespace}:${offer.id}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(offer => normalizarOfertaEpic(offer, consulted)),
  };
}

export const buscarOfertasEpic = (term, options) => consultarCatalogoEpic(term, options);
export const listarOfertasEpic = options => consultarCatalogoEpic(null, options);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await buscarOfertasEpic(process.argv.slice(2).join(' ') || 'Hades'), null, 2)); }
  catch (error) { console.error(`${error.code ?? 'ERROR'}: ${error.message}`); process.exitCode = 1; }
}
