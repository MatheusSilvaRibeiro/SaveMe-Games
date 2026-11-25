import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarJogos } from './steam-search.mjs';
const reply = items => async () => new Response(JSON.stringify({ items }));

test('codifica o nome e pede região Brasil sem selecionar automaticamente', async () => {
  const result = await buscarJogos(' Portal 2 & teste ', { fetchImpl: async url => {
    assert.equal(url.searchParams.get('term'), 'Portal 2 & teste');
    assert.equal(url.searchParams.get('cc'), 'BR');
    return reply([{ type: 'app', id: 620, name: 'Portal 2' }, { type: 'app', id: 323180, name: 'Portal 2 Soundtrack' }])();
  } });
  assert.deepEqual(result.resultados.map(x => x.appId), [620, 323180]);
});
test('nenhuma correspondência é lista vazia, não erro', async () => {
  assert.deepEqual((await buscarJogos('inexistente', { fetchImpl: reply([]) })).resultados, []);
});
test('não transforma bundles em AppIDs e remove duplicatas', async () => {
  const result = await buscarJogos('portal', { fetchImpl: reply([
    { type: 'bundle', id: 1, name: 'Bundle' },
    { type: 'app', id: 620, name: 'Portal 2' },
    { type: 'app', id: 620, name: 'Portal 2' },
  ]) });
  assert.equal(result.resultados.length, 1);
  assert.equal(result.resultados[0].appId, 620);
});
test('rejeita termo inválido antes de acessar a Steam', async () => {
  for (const term of ['', ' ', 'a', null, 'a'.repeat(101)]) {
    await assert.rejects(buscarJogos(term, { fetchImpl: () => assert.fail() }), { code: 'INVALID_QUERY' });
  }
});
test('resposta quebrada não se passa por busca sem resultados', async () => {
  for (const body of ['{}', '<html>', '{"items":[{"type":"app","id":"620","name":"Portal"}]}']) {
    await assert.rejects(buscarJogos('portal', { fetchImpl: async () => new Response(body) }), { code: 'INVALID_RESPONSE' });
  }
});
test('trata falhas HTTP, rede e timeout', async () => {
  await assert.rejects(buscarJogos('portal', { fetchImpl: async () => new Response('', { status: 429 }) }), { code: 'HTTP_ERROR' });
  await assert.rejects(buscarJogos('portal', { fetchImpl: async () => { throw new TypeError(); } }), { code: 'NETWORK_ERROR' });
  await assert.rejects(buscarJogos('portal', { fetchImpl: async () => { throw new DOMException('', 'TimeoutError'); } }), { code: 'TIMEOUT' });
});


test('metadados da busca preservam fonte da nota, sistemas e desconto', async () => {
  const result = await buscarJogos('portal', { fetchImpl: reply([
    { type: 'app', id: 620, name: 'Portal 2', metascore: '95', platforms: { windows: true, mac: false, linux: true }, price: { currency: 'BRL', initial: 10000, final: 5000 } },
    { type: 'app', id: 621, name: 'Sem dados', metascore: '', price: { currency: 'USD', final: 999 } },
  ]) });
  const [game, missing] = result.resultados;
  assert.equal(game.metacritic, 95);
  assert.deepEqual(game.sistemas, ['Windows', 'Linux']);
  assert.equal(game.precoCentavos, 5000);
  assert.equal(game.descontoPercentual, 50);
  assert.equal(missing.metacritic, null);
  assert.equal(missing.precoCentavos, null);
});
