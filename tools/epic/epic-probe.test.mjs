import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarOfertasEpic, listarOfertasEpic, normalizarOfertaEpic } from './epic-probe.mjs';

const offer = { id: 'hades-offer', namespace: 'min', title: 'Hades', offerType: 'BASE_GAME', productSlug: 'hades', price: { country: 'BR', price: { currencyCode: 'BRL', discountPrice: 7399 }, updatedAt: '2026-01-08T16:09:34Z' } };
const reply = offers => async () => new Response(JSON.stringify({ offers }));

test('consulta país e tipo corretos, com atribuição explícita e datas separadas', async () => {
  const response = await buscarOfertasEpic('Hades', { fetchImpl: async (url, options) => {
    assert.equal(new URL(url).searchParams.get('country'), 'BR');
    assert.equal(JSON.parse(options.body).offerType, 'BASE_GAME');
    return reply([offer])();
  } });
  assert.equal(response.fonte, 'EGData');
  assert.equal(response.resultados[0].precoCentavos, 7399);
  assert.equal(response.resultados[0].registroPrecoEm, offer.price.updatedAt);
  assert.notEqual(response.resultados[0].registroPrecoEm, response.consultadoEm);
  assert.equal(response.resultados[0].link, 'https://store.epicgames.com/pt-BR/p/hades');
});

test('não confunde falta de preço, preço zero e moeda/região incompatíveis', async () => {
  for (const price of [null, { country: 'US', price: { currencyCode: 'BRL', discountPrice: 0 } }, { country: 'BR', price: { currencyCode: 'USD', discountPrice: 0 } }]) {
    const response = await buscarOfertasEpic('Hades', { fetchImpl: reply([{ ...offer, price }]) });
    assert.equal(response.resultados[0].precoCentavos, null);
    assert.equal(response.resultados[0].situacaoPreco, 'indisponivel');
  }
  const free = await buscarOfertasEpic('Hades', { fetchImpl: reply([{ ...offer, price: { country: 'BR', price: { currencyCode: 'BRL', discountPrice: 0 } } }]) });
  assert.equal(free.resultados[0].situacaoPreco, 'gratuito_nesta_oferta');
});

test('preserva opções distintas, remove duplicatas e não transforma DLC em jogo base', async () => {
  const response = await buscarOfertasEpic('Hades', { fetchImpl: reply([offer, offer, { ...offer, id: 'hades2', title: 'Hades II' }, { ...offer, offerType: 'DLC' }]) });
  assert.deepEqual(response.resultados.map(item => item.nome), ['Hades', 'Hades II']);
});

test('não cria link a partir de slug ausente ou inválido', async () => {
  for (const slug of [null, '../../admin', 'https://example.com']) {
    const response = await buscarOfertasEpic('Hades', { fetchImpl: reply([{ ...offer, productSlug: slug }]) });
    assert.equal(response.resultados[0].link, null);
  }
});

test('trata lista vazia, estrutura inválida, limite e timeout distintamente', async () => {
  assert.deepEqual((await buscarOfertasEpic('zzzz', { fetchImpl: reply([]) })).resultados, []);
  await assert.rejects(buscarOfertasEpic('Hades', { fetchImpl: async () => new Response('{}') }), { code: 'INVALID_RESPONSE' });
  await assert.rejects(buscarOfertasEpic('Hades', { fetchImpl: async () => new Response('', { status: 429 }) }), { code: 'RATE_LIMITED' });
  await assert.rejects(buscarOfertasEpic('Hades', { fetchImpl: async () => { throw new DOMException('', 'TimeoutError'); } }), { code: 'TIMEOUT' });
});

test('entrada inválida não acessa a fonte', async () => {
  await assert.rejects(buscarOfertasEpic(' ', { fetchImpl: () => assert.fail() }), { code: 'INVALID_QUERY' });
});

test('catálogo sem termo e busca paginam qualquer jogo base, sem lista fixa', async () => {
  for (const term of [null, 'Celeste']) {
    const options = { page: 2, fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.page, 2);
      assert.equal(body.limit, 12);
      assert.equal(body.title, term ?? undefined);
      return new Response(JSON.stringify({ total: 25, offers: [{ ...offer, title: 'Celeste' }] }));
    } };
    const result = await (term === null ? listarOfertasEpic(options) : buscarOfertasEpic(term, options));
    assert.equal(result.proximaPagina, 3);
    assert.equal(result.resultados[0].nome, 'Celeste');
  }
});

test('preço cadastrado em lançamento futuro não significa venda ativa ou gratuidade', () => {
  const result = normalizarOfertaEpic({ ...offer, effectiveDate: '2099-01-01T00:00:00Z', price: { country: 'BR', price: { currencyCode: 'BRL', discountPrice: 0 } } });
  assert.equal(result.emBreve, true);
  assert.equal(result.precoCentavos, null);
  assert.equal(result.situacaoPreco, 'indisponivel');
  assert.equal(normalizarOfertaEpic({ ...offer, countriesBlacklist: ['BR'] }).precoCentavos, null);
  assert.equal(normalizarOfertaEpic({ ...offer, isCodeRedemptionOnly: true }).precoCentavos, null);
});
test('prioriza página da oferta e não inventa checkout ou link de compra', () => {
  const result = normalizarOfertaEpic({ ...offer, productSlug: 'game-edition', offerMappings: [{ pageType: 'productHome', pageSlug: 'game-overview' }] });
  assert.equal(result.link, 'https://store.epicgames.com/pt-BR/p/game-edition');
});

test('identifica restrição regional, plataforma móvel e mapeamento de oferta', () => {
  const mobile = normalizarOfertaEpic({ ...offer, productSlug: null, tags: [{ id: '39070', name: 'iOS' }], offerMappings: [{ pageType: 'offer', pageSlug: 'hades-ios' }] });
  assert.equal(mobile.somenteMobile, true);
  assert.equal(mobile.link, 'https://store.epicgames.com/pt-BR/p/hades-ios');
  const restricted = normalizarOfertaEpic({ ...offer, countriesBlacklist: ['BR'] });
  assert.equal(restricted.disponibilidade, 'fora_regiao');
  assert.equal(restricted.precoCentavos, null);
  assert.equal(normalizarOfertaEpic({ ...offer, price: null }).disponibilidade, 'sem_preco');
});
