import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { DatabaseService } from '../src/database.js';
import { fileGameAssociations } from '../src/comparison/catalog.js';
import { PrismaGameAssociations } from '../src/comparison/prisma-catalog.js';

const testUrl = process.env.CATALOG_TEST_DATABASE_URL;

test('PostgreSQL armazena associações e observações e preserva o contrato de comparação', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.endsWith('_test'),
    'Use um PostgreSQL descartável local e um banco com sufixo _test.');
  process.env.DATABASE_URL = testUrl;
  const db = new DatabaseService();
  try {
    const catalog = new PrismaGameAssociations(db);
    const seeded = await fileGameAssociations.list();
    assert.deepEqual(await catalog.list(), seeded);
    assert.equal(await db.game.count(), 5);
    assert.equal(await db.store.count(), 2);
    assert.equal(await db.storeOffer.count(), 10);
    for (const game of seeded) {
      assert.deepEqual(await catalog.findById(game.id), game);
      assert.deepEqual(await catalog.findBySteamAppId(game.steam.appId), game);
    }

    const time = new Date();
    const sourceRecordedAt = new Date(time.getTime() - 60000);
    const game = seeded.find(game => game.id === 'hades')!;
    const steam = {
      tipo: 'game', appId: game.steam.appId, regiao: 'BR', moeda: 'BRL',
      precoCentavos: 0, situacaoPreco: 'gratuito', consultadoEm: time.toISOString(),
    };
    const epic = {
      tipoOferta: 'BASE_GAME', id: game.epic.offerId, namespace: game.epic.namespace, regiao: 'BR',
      precoCentavos: null, consultadoEm: time.toISOString(), registroPrecoEm: sourceRecordedAt.toISOString(),
    };
    const app = await createApp({ buscarJogos: async () => ({}), consultarJogo: async () => steam },
      { search: async () => ({}), list: async () => ({}), details: async () => epic });
    try {
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/comparisons`;
      const response = await fetch(`${base}/steam/${game.steam.appId}`);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result.jogo, game);
      assert.equal(result.situacao, 'parcial');
      assert.deepEqual(await (await fetch(`${base}/hades`)).json(), result);
      await catalog.recordPrices(result);
      const observations = await db.priceObservation.findMany({
        where: { collectedAt: time, offer: { gameId: game.id } },
        include: { offer: true }, orderBy: { offer: { storeCode: 'asc' } },
      });
      assert.deepEqual(observations.map(row => [row.offer.storeCode, row.priceCents, row.state, row.currency, row.region, row.sourceRecordedAt]), [
        ['steam', 0n, 'available', 'BRL', 'BR', null],
        ['epic', null, 'price_missing', 'BRL', 'BR', sourceRecordedAt],
      ]);
      const { offerId, collectedAt, state, currency, region, priceCents } = observations[0];
      await assert.rejects(db.priceObservation.create({ data: { offerId, collectedAt, state, currency, region, priceCents } }));
      await assert.rejects(db.priceObservation.create({ data: {
        offerId, collectedAt: new Date(time.getTime() + 1), state: 'price_missing', currency, region, priceCents: 0n,
      } }));
      await assert.rejects(db.priceObservation.create({ data: {
        offerId, collectedAt: new Date(time.getTime() + 1), state: 'available', currency, region, priceCents: null,
      } }));
    } finally { await app.close(); }

    const probeId = `constraint-probe-${crypto.randomUUID()}`;
    await db.game.create({ data: { id: probeId, name: 'Probe', edition: 'Jogo base', platform: 'PC' } });
    try {
      await assert.rejects(db.storeOffer.create({ data: { gameId: probeId, storeCode: 'steam', steamAppId: BigInt(game.steam.appId) } }));
      await assert.rejects(db.storeOffer.create({ data: {
        gameId: probeId, storeCode: 'epic', epicNamespace: game.epic.namespace, epicOfferId: game.epic.offerId, epicPageSlug: game.epic.pageSlug,
      } }));
      await assert.rejects(db.storeOffer.create({ data: { gameId: probeId, storeCode: 'steam', epicOfferId: game.epic.offerId } }));
    } finally { await db.game.delete({ where: { id: probeId } }); }
  } finally { await db.$disconnect(); }
});
