import test from 'node:test';
import assert from 'node:assert/strict';
import { listarDestaques } from './steam-featured.mjs';

test('combina destaques reais, remove duplicatas e não transforma pacotes em apps', async () => {
  const first = { type: 0, id: 620, name: 'Portal 2', currency: 'BRL', final_price: 1000, original_price: 2000 };
  const games = await listarDestaques({ fetchImpl: async () => new Response(JSON.stringify({
    top_sellers: { items: [first, first] },
    specials: { items: [{ type: 1, id: 2, name: 'Pacote' }, { ...first, id: 570, name: 'Dota 2', final_price: 0 }] },
    new_releases: { items: [{ ...first, id: 730, name: 'CS2' }] },
  })) });
  assert.deepEqual(games.map(item => item.appId), [620, 570, 730]);
  assert.equal(games[0].descontoPercentual, 50);
  assert.equal(games[1].precoCentavos, 0);
});

test('resposta inválida não se passa por lista vazia', async () => {
  await assert.rejects(listarDestaques({ fetchImpl: async () => new Response('{}') }), { code: 'INVALID_RESPONSE' });
});

test('trata falha HTTP e timeout da listagem', async () => {
  await assert.rejects(listarDestaques({ fetchImpl: async () => new Response('', { status: 500 }) }), { code: 'HTTP_ERROR' });
  await assert.rejects(listarDestaques({ fetchImpl: async () => { throw new DOMException('', 'TimeoutError'); } }), { code: 'TIMEOUT' });
});
