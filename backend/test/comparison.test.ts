import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createComparisonService } from '../src/comparison/service.js';
import { fileGameAssociations } from '../src/comparison/catalog.js';
import { createApp } from '../src/app.js';
const time = '2026-10-21T12:00:00Z';
const steam = { appId: 1145360, tipo: 'game', nome: 'Hades', regiao: 'BR', moeda: 'BRL', precoCentavos: 9999, situacaoPreco: 'informado', consultadoEm: time };
const epic = { id: '2ae6edb2223c4f8c97e9839b5b6497bb', namespace: 'min', tipoOferta: 'BASE_GAME', nome: 'Hades', regiao: 'BR', moeda: 'BRL', precoCentavos: 7399, situacaoPreco: 'informado', consultadoEm: time, registroPrecoEm: '2026-01-08T00:00:00Z' };
const service = (s: unknown = steam, e: unknown = epic) => createComparisonService(fileGameAssociations, { steam: async () => s, epic: async () => e });

test('ordena ofertas e calcula menor preço e economia em centavos', async () => {
  const result = await service().compare('hades');
  assert.equal(result.ofertas[0].loja, 'Epic Games Store');
  assert.equal(result.menorPrecoCentavos, 7399);
  assert.equal(result.economiaCentavos, 2600);
  assert.deepEqual(result.lojasMenorPreco, ['Epic Games Store']);
  assert.equal(result.ofertas[0].fonte, 'EGData');
  assert.equal(result.ofertas[0].consultadoEm, time);
  assert.equal(result.ofertas[0].registroPrecoEm, epic.registroPrecoEm);
});
test('preços iguais identificam as duas lojas e economia zero', async () => {
  const result = await service(steam, { ...epic, precoCentavos: 9999 }).compare('hades');
  assert.equal(result.economiaCentavos, 0);
  assert.equal(result.lojasMenorPreco.length, 2);
});
test('gratuidade explícita participa da comparação sem confundir ausência de preço', async () => {
  const free = await service(steam, { ...epic, precoCentavos: 0, situacaoPreco: 'gratuito_nesta_oferta' }).compare('hades');
  assert.equal(free.menorPrecoCentavos, 0);
  assert.equal(free.economiaCentavos, 9999);
  const missing = await service(steam, { ...epic, precoCentavos: null, moeda: null }).compare('hades');
  assert.equal(missing.situacao, 'parcial');
  assert.equal(missing.economiaCentavos, null);
  assert.equal(missing.menorPrecoCentavos, null);
  assert.deepEqual(missing.lojasMenorPreco, []);
});
test('não compara outro jogo, edição adicional, namespace, moeda ou região', async () => {
  for (const patch of [{ namespace: 'other' }, { id: 'other' }, { tipoOferta: 'DLC' }, { moeda: 'USD' }, { regiao: 'US' }, { precoCentavos: -1 }, { consultadoEm: 'invalid' }, { somenteMobile: true }]) {
    const result = await service(steam, { ...epic, ...patch }).compare('hades');
    assert.equal(result.situacao, 'parcial');
    assert.equal(result.ofertas[1].precoCentavos, null);
    assert.equal(result.economiaCentavos, null);
  }
  assert.equal((await service({ ...steam, tipo: 'dlc' }).compare('hades')).situacao, 'parcial');
});
test('falha de uma loja preserva a outra; ambas sem preço não criam economia', async () => {
  const client = createComparisonService(fileGameAssociations, { steam: async () => steam, epic: async () => { throw new Error('segredo interno'); } });
  const result = await client.compare('hades');
  assert.equal(result.situacao, 'parcial');
  assert.equal(result.ofertas[0].precoCentavos, 9999);
  assert.ok(!JSON.stringify(result).includes('segredo interno'));
  assert.equal((await service({ ...steam, precoCentavos: null }, { ...epic, precoCentavos: null }).compare('hades')).situacao, 'sem_precos');
});
test('jogo não associado não consulta fontes; cache deduplica e retorna cópias', async () => {
  let calls = 0;
  const client = createComparisonService(fileGameAssociations, { steam: async () => { calls++; return steam; }, epic: async () => epic });
  await assert.rejects(client.compare('unknown'), (error: unknown) => (error as { getStatus(): number }).getStatus() === 404);
  assert.equal(calls, 0);
  const [first] = await Promise.all([client.compare('hades'), client.compare('hades')]);
  first.ofertas[0].precoCentavos = 1;
  assert.equal((await client.compare('hades')).menorPrecoCentavos, 7399);
  assert.equal(calls, 1);
});
test('rota HTTP lista associações e compara sem conexão com o banco', async () => {
  const app = await createApp({ buscarJogos: async () => ({}), consultarJogo: async () => steam }, { search: async () => ({}), list: async () => ({}), details: async () => epic });
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/comparisons`;
    const games = await (await fetch(`${base}/games`)).json();
    assert.equal(games[0].id, 'hades');
    const response = await fetch(`${base}/hades`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).economiaCentavos, 2600);
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
    assert.equal((await fetch(`${base}/INVALID`)).status, 400);
  } finally { await app.close(); }
});

test('todas as associações usam seus próprios IDs e preservam a edição conferida', async () => {
  const games = await fileGameAssociations.list();
  assert.ok(games.length >= 4);
  assert.equal(new Set(games.map(game => game.id)).size, games.length);
  assert.equal(new Set(games.map(game => game.steam.appId)).size, games.length);
  for (const game of games) {
    const client = createComparisonService(fileGameAssociations, {
      steam: async id => { assert.equal(id, String(game.steam.appId)); return { ...steam, appId: game.steam.appId, nome: game.nome }; },
      epic: async id => { assert.equal(id, game.epic.offerId); return { ...epic, id, namespace: game.epic.namespace, nome: game.nome }; },
    });
    const result = await client.compare(game.id);
    assert.equal(result.situacao, 'comparavel');
    assert.equal(result.jogo.edicao, game.edicao);
    assert.equal(result.economiaCentavos, 2600);
    assert.equal(result.ofertas[0].link, `https://store.epicgames.com/pt-BR/p/${game.epic.pageSlug}`);
  }
});
test('desconto é calculado na própria loja e gratuidade inconsistente é rejeitada', async () => {
  const result = await service(steam, { ...epic, precoOriginalCentavos: 14798 }).compare('hades');
  assert.equal(result.ofertas[0].descontoPercentual, 50);
  assert.equal(result.ofertas[0].precoOriginalCentavos, 14798);
  assert.equal((await service(steam, { ...epic, situacaoPreco: 'gratuito' }).compare('hades')).situacao, 'parcial');
});
