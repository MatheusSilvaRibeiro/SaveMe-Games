import test from 'node:test';
import assert from 'node:assert/strict';
import { createEpicCatalog } from './epic-catalog.mjs';
const offer = { id: 'one', namespace: 'ns', nome: 'Jogo', precoCentavos: 1000, disponibilidade: 'disponivel', link: 'https://store.epicgames.com/pt-BR/p/game' };
const response = resultados => ({ resultados, proximaPagina: 2 });

test('catálogo inicial prioriza ofertas utilizáveis, excluindo mobile e fora do Brasil', async () => {
 const data = response([offer, { ...offer, id: 'mobile', somenteMobile: true }, { ...offer, id: 'br', disponibilidade: 'fora_regiao' }, { ...offer, id: 'future', disponibilidade: 'em_breve', precoCentavos: null }, { ...offer, id: 'missing', disponibilidade: 'sem_preco', precoCentavos: null }]);
 const catalog = createEpicCatalog({ list: async () => data, details: async () => { throw new Error('offline'); } });
 const result = await catalog.list({ page: 1 });
 assert.deepEqual(result.resultados.map(item => item.id), ['one']);
 assert.equal(result.proximaPagina, 2);
});
test('recupera preço ou página por identidade, preserva resultados quando a consulta falha', async () => {
 const data = response([{ ...offer, id: 'recover', precoCentavos: null, disponibilidade: 'sem_preco', link: null }, { ...offer, id: 'missing', precoCentavos: null, disponibilidade: 'sem_preco', link: null }]);
 const catalog = createEpicCatalog({ search: async () => data, details: async (id, options) => {
   assert.equal(options.namespaceEsperado, 'ns');
   if (id === 'missing') throw new Error('timeout');
   return { ...offer, id };
 } });
 const result = await catalog.search('jogo');
 assert.equal(result.resultados[0].precoCentavos, 1000);
 assert.equal(result.resultados[1].precoCentavos, null);
});
test('não aceita enriquecimento de outro produto e limita consultas incompletas', async () => {
 let calls = 0, active = 0, maxActive = 0;
 const data = response(Array.from({ length: 8 }, (_, index) => ({ ...offer, id: String(index), link: null })));
 const catalog = createEpicCatalog({ search: async () => data, details: async id => {
   calls++; active++; maxActive = Math.max(maxActive, active);
   await new Promise(resolve => setImmediate(resolve)); active--;
   return { ...offer, id, namespace: 'wrong' };
 } });
 const result = await catalog.search('jogo');
 assert.equal(calls, 4); assert.ok(maxActive <= 2);
 assert.ok(result.resultados.every(item => item.link === null));
});
test('cache deduplica consultas simultâneas e expira sem mudar a região', async () => {
 let calls = 0, time = 0;
 const catalog = createEpicCatalog({ list: async () => { calls++; return response([offer]); }, now: () => time, ttlMs: 100 });
 await Promise.all([catalog.list(), catalog.list()]);
 await catalog.list(); assert.equal(calls, 1);
 time = 101; await catalog.list(); assert.equal(calls, 2);
});
