import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app.js';
import { SteamError } from '../../tools/steam/steam-probe.mjs';

let app: INestApplication;
let base: string;
let calls = 0;

before(async () => {
  app = await createApp({
    buscarJogos: async term => {
      calls++;
      if (term === 'timeout') throw new SteamError('TIMEOUT', 'Tempo esgotado.');
      if (term === 'offline') throw new SteamError('NETWORK_ERROR', 'Fonte indisponível.');
      if (term === 'broken') throw new SteamError('INVALID_RESPONSE', 'Resposta inválida.');
      return { termo: term, resultados: term === 'vazio' ? [] : [{ appId: 620, nome: 'Portal 2' }] };
    },
    consultarJogo: async id => {
      calls++;
      if (id === '999999') throw new SteamError('UNAVAILABLE', 'Jogo indisponível.');
      return { appId: Number(id), nome: 'Portal 2', moeda: 'BRL', precoCentavos: 3399 };
    },
  }, { search: async term => ({ termo: term, resultados: [], proximaPagina: null, pagina: 1, loja: 'Epic Games Store', fonte: 'EGData', regiao: 'BR', consultadoEm: new Date().toISOString() }), list: async () => ({ termo: '', resultados: [], proximaPagina: null, pagina: 1, loja: 'Epic Games Store', fonte: 'EGData', regiao: 'BR', consultadoEm: new Date().toISOString() }), details: async () => ({ id: '2ae6edb2223c4f8c97e9839b5b6497bb', namespace: 'min', nome: 'Hades', tipoOferta: 'BASE_GAME', loja: 'Epic Games Store', fonte: 'EGData', regiao: 'BR', precoCentavos: 7399, moeda: 'BRL', situacaoPreco: 'informado', link: 'https://store.epicgames.com/pt-BR/p/hades', registroPrecoEm: null, consultadoEm: new Date().toISOString(), imagem: null, generos: [], emBreve: false }) });
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api`;
});
after(async () => { await app?.close(); });

test('health responde sem depender da Steam', async () => {
  const count = calls;
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).steam, 'not_checked');
  assert.equal(calls, count);
});
test('busca e detalhes passam pela API HTTP', async () => {
  const search = await fetch(`${base}/steam/games?q=Portal%202`);
  assert.equal(search.status, 200);
  assert.equal((await search.json()).resultados[0].appId, 620);
  const details = await fetch(`${base}/steam/games/620`);
  assert.equal(details.status, 200);
  assert.equal((await details.json()).precoCentavos, 3399);
});
test('sem correspondência retorna 200 com lista vazia', async () => {
  const response = await fetch(`${base}/steam/games?q=vazio`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).resultados, []);
});
test('entradas inválidas retornam 400 sem acessar fonte', async () => {
  const count = calls;
  for (const path of ['/steam/games', '/steam/games?q=a', '/steam/games?q=aa&q=bb', '/steam/games/abc', '/steam/featured?page=0', '/steam/featured?page=x']) {
    assert.equal((await fetch(`${base}${path}`)).status, 400);
  }
  assert.equal(calls, count);
});
test('preserva diferença entre indisponível, timeout e resposta quebrada', async () => {
  for (const [path, status, code] of [
    ['/steam/games/999999', 404, 'UNAVAILABLE'],
    ['/steam/games?q=timeout', 504, 'TIMEOUT'],
    ['/steam/games?q=offline', 503, 'NETWORK_ERROR'],
    ['/steam/games?q=broken', 502, 'INVALID_RESPONSE'],
  ] as const) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(body.stack, undefined);
  }
});
test('permite acesso do frontend local', async () => {
  const response = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('Epic expõe catálogo, busca e detalhes sem restrição ao Hades', async () => {
  assert.equal((await fetch(`${base}/epic/games`)).status, 200);
  assert.equal((await fetch(`${base}/epic/games?q=Celeste`)).status, 200);
  const body = await (await fetch(`${base}/epic/games/some-offer`)).json();
  assert.equal(body.precoCentavos, 7399);
  assert.equal(body.fonte, 'EGData');
  for (const path of ['/epic/games?q=a', '/epic/games?page=0', '/epic/games?q=aa&q=bb']) {
    assert.equal((await fetch(`${base}${path}`)).status, 400);
  }
});
