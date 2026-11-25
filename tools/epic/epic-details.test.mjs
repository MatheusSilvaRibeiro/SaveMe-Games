import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarOfertaEpic } from './epic-details.mjs';

const id = 'hades-offer';
const offer = { id, namespace: 'min', title: 'Hades', offerType: 'BASE_GAME', productSlug: null, offerMappings: [{ pageType: 'productHome', pageSlug: 'hades' }] };
const price = { offerId: id, namespace: 'min', country: 'BR', updatedAt: '2026-01-08T00:00:00Z', price: { currencyCode: 'BRL', discountPrice: 7399 } };
const source = (metadata = offer, priceRecord = price) => async url => {
  assert.equal(new URL(url).searchParams.get('country'), 'BR');
  return new Response(JSON.stringify(url.includes('/price?') ? priceRecord : metadata));
};

test('consulta preço por ID e usa mapeamento de página sem adivinhar pelo título', async () => {
  const result = await consultarOfertaEpic(id, { fetchImpl: source(), namespaceEsperado: 'min' });
  assert.equal(result.precoCentavos, 7399);
  assert.equal(result.link, 'https://store.epicgames.com/pt-BR/p/hades');
  assert.equal(result.registroPrecoEm, price.updatedAt);
  assert.equal(result.fonte, 'EGData');
});

test('não associa preço ou namespace de outro produto', async () => {
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: source(), namespaceEsperado: 'other' }), { code: 'INVALID_RESPONSE' });
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: source(offer, { ...price, offerId: 'other' }) }), { code: 'INVALID_RESPONSE' });
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: source({ ...offer, id: 'other' }) }), { code: 'INVALID_RESPONSE' });
});

test('404 do preço indica preço ausente; 404 da oferta indica oferta indisponível', async () => {
  const result = await consultarOfertaEpic(id, { fetchImpl: async url => url.includes('/price?') ? new Response('', { status: 404 }) : new Response(JSON.stringify(offer)) });
  assert.equal(result.precoCentavos, null);
  assert.equal(result.situacaoPreco, 'indisponivel');
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: async () => new Response('', { status: 404 }) }), { code: 'UNAVAILABLE' });
});

test('recusa DLC e ID inválido', async () => {
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: source({ ...offer, offerType: 'DLC' }) }), { code: 'INCOMPATIBLE_OFFER' });
  await assert.rejects(consultarOfertaEpic('../private', { fetchImpl: () => assert.fail() }), { code: 'INVALID_ID' });
});

test('falhas de consulta não viram oferta sem preço', async () => {
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: async () => new Response('', { status: 429 }) }), { code: 'RATE_LIMITED' });
  await assert.rejects(consultarOfertaEpic(id, { fetchImpl: async () => { throw new DOMException('', 'TimeoutError'); } }), { code: 'TIMEOUT' });
});
