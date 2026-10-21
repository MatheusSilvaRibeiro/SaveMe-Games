import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, PAGE_SIZE } from './steam-catalog.mjs';

test('gratuito sem preço na busca é confirmado pelos detalhes', async () => {
  const catalog = createCatalog({ lookup: async id => ({ appId: Number(id), tipo: 'game', precoCentavos: 0, situacaoPreco: 'gratuito', generos: ['Estratégia'] }) });
  const response = await catalog.enrich({ resultados: [{ appId: 570, nome: 'Dota 2', precoCentavos: null }] });
  assert.equal(response.resultados[0].situacaoPreco, 'gratuito');
  assert.equal(response.resultados[0].precoCentavos, 0);
  assert.deepEqual(response.resultados[0].generos, ['Estratégia']);
});

test('falha nos detalhes mantém desconhecido e não inventa gratuidade', async () => {
  const catalog = createCatalog({ lookup: async () => { throw new Error('offline'); } });
  const response = await catalog.enrich({ resultados: [{ appId: 1, precoCentavos: null }, { appId: 2, precoCentavos: 1000 }] });
  assert.equal(response.resultados[0].situacaoPreco, 'indisponivel');
  assert.equal(response.resultados[0].precoCentavos, null);
  assert.equal(response.resultados[1].precoCentavos, 1000);
});

test('reutiliza consultas simultâneas e cache; expiração exige nova consulta', async () => {
  let calls = 0, clock = 0;
  const catalog = createCatalog({ ttlMs: 100, now: () => clock, lookup: async id => { calls++; return { appId: Number(id) }; } });
  await Promise.all([catalog.details(620), catalog.details('620')]);
  await catalog.details(620);
  assert.equal(calls, 1);
  clock = 101;
  await catalog.details(620);
  assert.equal(calls, 2);
});


const listing = Array.from({ length: 25 }, (_, index) => ({ appId: index + 1, nome: `Game ${index + 1}`, precoCentavos: null }));

test('paginação mantém ordem, limita concorrência e preserva resultado se detalhes falham', async () => {
  let active = 0, maximum = 0;
  const catalog = createCatalog({ list: async () => listing, lookup: async id => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (id === '1') throw new Error('offline');
    return { appId: Number(id), tipo: 'game' };
  } });
  const first = await catalog.featured();
  assert.equal(first.resultados.length, PAGE_SIZE);
  assert.equal(first.resultados[0].nome, 'Game 1');
  assert.equal(first.proximaPagina, 2);
  const second = await catalog.featured(2);
  assert.equal(second.resultados[0].appId, 13);
  assert.equal(second.resultados.length, 12);
  const last = await catalog.featured(3);
  assert.equal(last.resultados.length, 1);
  assert.equal(last.proximaPagina, null);
  assert.ok(maximum <= 3);
});

test('falha da lista não vira catálogo vazio e pode ser repetida', async () => {
  let failing = true, calls = 0;
  const catalog = createCatalog({ list: async () => { calls++; if (failing) throw new Error('offline'); return listing; }, lookup: async id => ({ appId: Number(id) }) });
  await assert.rejects(catalog.featured(), /offline/);
  failing = false;
  await catalog.featured(); await catalog.featured(2);
  assert.equal(calls, 2);
  await assert.rejects(catalog.featured(0), { code: 'INVALID_QUERY' });
});
