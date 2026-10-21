import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarJogo } from './steam-probe.mjs';

const data = { steam_appid: 620, name: 'Portal 2', type: 'game', is_free: false };
const fake = (value) => async () => new Response(JSON.stringify(value), { status: 200 });
const answer = (extra) => ({ 620: { success: true, data: { ...data, ...extra } } });

test('consulta Brasil e preserva preço em centavos', async () => {
  const result = await consultarJogo(620, { fetchImpl: async (url) => {
    assert.equal(url.searchParams.get('cc'), 'br');
    assert.equal(url.searchParams.get('appids'), '620');
    return fake(answer({ price_overview: { currency: 'BRL', final: 3399 } }))();
  } });
  assert.equal(result.precoCentavos, 3399);
  assert.equal(result.moeda, 'BRL');
});
test('não confunde preço ausente com gratuito', async () => {
  const result = await consultarJogo(620, { fetchImpl: fake(answer({})) });
  assert.equal(result.precoCentavos, null);
  assert.equal(result.situacaoPreco, 'indisponivel');
});
test('reconhece jogo declarado gratuito', async () => {
  const result = await consultarJogo(620, { fetchImpl: fake(answer({ is_free: true })) });
  assert.equal(result.precoCentavos, 0);
  assert.equal(result.situacaoPreco, 'gratuito');
});
test('não rotula preço estrangeiro como BRL', async () => {
  const result = await consultarJogo(620, { fetchImpl: fake(answer({ price_overview: { currency: 'USD', final: 999 } })) });
  assert.equal(result.precoCentavos, null);
});
test('trata indisponibilidade retornada pela fonte', async () => {
  await assert.rejects(consultarJogo(620, { fetchImpl: fake({ 620: { success: false } }) }), { code: 'UNAVAILABLE' });
});
test('trata HTTP 429 e 500 sem repetir automaticamente', async () => {
  for (const status of [429, 500]) {
    await assert.rejects(consultarJogo(620, { fetchImpl: async () => new Response('', { status }) }), { code: 'HTTP_ERROR' });
  }
});
test('trata falha de rede', async () => {
  await assert.rejects(consultarJogo(620, { fetchImpl: async () => { throw new TypeError('fetch failed'); } }), { code: 'NETWORK_ERROR' });
});
test('trata timeout simulado', async () => {
  await assert.rejects(consultarJogo(620, { fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), { code: 'TIMEOUT' });
});
test('rejeita JSON e estrutura inválidos', async () => {
  await assert.rejects(consultarJogo(620, { fetchImpl: async () => new Response('<html>') }), { code: 'INVALID_RESPONSE' });
  await assert.rejects(consultarJogo(620, { fetchImpl: fake({}) }), { code: 'INVALID_RESPONSE' });
});
test('rejeita ID inválido antes da chamada externa', async () => {
  await assert.rejects(consultarJogo('../620', { fetchImpl: () => assert.fail('Não deveria consultar') }), { code: 'INVALID_ID' });
});


test('detalhes incluem especificações válidas sem inventar avaliação ausente', async () => {
  const game = await consultarJogo(620, { fetchImpl: fake(answer({
    genres: [{ description: 'Aventura' }, {}], developers: ['Valve', null],
    release_date: { date: '18 abr. 2011', coming_soon: false },
    platforms: { windows: true }, metacritic: { score: 95 },
  })) });
  assert.deepEqual(game.generos, ['Aventura']);
  assert.deepEqual(game.desenvolvedoras, ['Valve']);
  assert.equal(game.lancamento, '18 abr. 2011');
  assert.equal(game.metacritic, 95);
  const missing = await consultarJogo(620, { fetchImpl: fake(answer({ metacritic: { score: 101 } })) });
  assert.equal(missing.metacritic, null);
  assert.deepEqual(missing.generos, []);
});
