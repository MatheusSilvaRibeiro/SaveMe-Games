import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { collectPrices } from '../src/comparison/collect-prices.js';
import { PrismaGameAssociations } from '../src/comparison/prisma-catalog.js';
import { createComparisonService, type OfferIdentity } from '../src/comparison/service.js';
import { persistPriceObservations } from '../src/comparison/price-observation.js';
import { DatabaseService } from '../src/database.js';

const testUrl = process.env.ALERTS_TEST_DATABASE_URL;
const origin = 'http://127.0.0.1:5173';

test('detecta quedas por oferta e protege a caixa de avisos da conta', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.endsWith('_test'));
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = crypto.randomUUID();
  process.env.AUTH_ORIGINS = origin;
  const db = new DatabaseService();
  const competitor = new DatabaseService();
  const start = Date.now() - 600000;
  const time = (round: number) => new Date(start + round * 1000);
  const emails = [`alerts-a-${crypto.randomUUID()}@example.invalid`, `alerts-b-${crypto.randomUUID()}@example.invalid`];
  const gameId = 'hades';
  const steam = (appId: number, price: number | null, round: number) => ({
    appId, tipo: 'game', regiao: 'BR', moeda: 'BRL', precoCentavos: price,
    situacaoPreco: price === 0 ? 'gratuito' : 'informado', consultadoEm: time(round).toISOString(),
  });
  const epic = (offerId: string, namespace: string, round: number) => ({
    id: offerId, namespace, tipoOferta: 'BASE_GAME', regiao: 'BR', moeda: 'BRL',
    precoCentavos: 1000, situacaoPreco: 'informado', consultadoEm: time(round).toISOString(),
  });
  const fixture = (identity: OfferIdentity, round: number, price: number | null) => identity.store === 'steam'
    ? steam(identity.appId, price, round) : epic(identity.offerId, identity.namespace, round);
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`;
    const headers = (cookie = '', requestOrigin = origin) => ({ Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json' });
    async function register(email: string) {
      const response = await fetch(`${base}/auth/register`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ email, name: 'Teste avisos', password: 'senha-de-teste' }),
      });
      assert.equal(response.status, 201);
      const { user } = await response.json();
      const cookie = response.headers.getSetCookie().find(value => value.startsWith('saveme_session_api='))!.split(';')[0];
      return { id: user.id as string, cookie };
    }
    const [a, b] = await Promise.all(emails.map(register));
    const get = (path: string, cookie = '') => fetch(`${base}/alerts${path}`, { headers: { Cookie: cookie } });
    const mark = (id: string, cookie = '', requestOrigin = origin) =>
      fetch(`${base}/alerts/${id}/read`, { method: 'PATCH', headers: headers(cookie, requestOrigin), body: '{}' });
    const rows = (userId: string) => db.priceAlert.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    await db.favorite.create({ data: { userId: a.id, gameId, createdAt: time(0) } });
    const association = (await new PrismaGameAssociations(db).findById(gameId))!;
    const steamOffer = await db.storeOffer.findUniqueOrThrow({ where: { steamAppId: BigInt(association.steam.appId) } });
    // Baselines mais altas de outros mercados devem ser ignoradas.
    await db.$transaction(tx => persistPriceObservations(tx, [
      { offerId: steamOffer.id, region: 'BR', currency: 'USD', priceCents: 9999n, state: 'available', collectedAt: time(-1) },
      { offerId: steamOffer.id, region: 'US', currency: 'BRL', priceCents: 9999n, state: 'available', collectedAt: time(0) },
    ]));
    const collect = (round: number, price: number | null) => collectPrices(db, async identity => fixture(identity, round, price));
    assert.equal((await collect(1, 5000)).status, 'completed');
    assert.equal((await rows(a.id)).length, 0); // primeira observação, inclusive Epic mais barata
    await collect(2, 5000);
    await collect(3, 6000);
    await collect(4, null);
    await collectPrices(db, async identity => {
      if (identity.store === 'steam') throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
      return fixture(identity, 5, null);
    });
    assert.equal((await rows(a.id)).length, 0);

    const compare = (round: number, price: number) => {
      const repo = new PrismaGameAssociations(competitor);
      return createComparisonService(repo, {
        steam: async id => steam(Number(id), price, round),
        epic: async id => epic(id, association.epic.namespace, round),
      }, result => repo.recordPrices(result)).compareBySteamAppId(String(association.steam.appId));
    };
    await compare(6, 4000);
    const [first] = await rows(a.id);
    assert.deepEqual([first.store, first.previousPriceCents, first.newPriceCents, first.observedAt, first.gameName],
      ['steam', 6000n, 4000n, time(6), 'Hades']);
    await db.favorite.create({ data: { userId: b.id, gameId, createdAt: time(7) } });
    await collect(6, 4000);
    assert.equal((await rows(a.id)).length, 1);
    assert.equal((await rows(b.id)).length, 0);

    await Promise.all([collect(8, 0), compare(8, 0), compare(8, 0)]);
    const aRows = await rows(a.id);
    const bRows = await rows(b.id);
    assert.equal(aRows.length, 2);
    assert.equal(bRows.length, 1);
    assert.equal(aRows[1].observationId, bRows[0].observationId);
    assert.deepEqual([aRows[1].previousPriceCents, aRows[1].newPriceCents], [4000n, 0n]);
    assert.equal(await db.priceObservation.count({ where: { offerId: steamOffer.id, region: 'BR', collectedAt: time(8) } }), 1);

    assert.equal((await get('')).status, 401);
    assert.equal((await get('/unread')).status, 401);
    assert.equal((await mark(String(first.id))).status, 401);
    assert.equal((await get('?limit=51', a.cookie)).status, 400);
    assert.equal((await get('?before=9223372036854775808', a.cookie)).status, 400);
    const page = await get('?limit=1', a.cookie);
    assert.match(page.headers.get('cache-control')!, /no-store/);
    const page1 = await page.json();
    assert.equal(page1.items[0].id, String(aRows[1].id));
    assert.equal(page1.items[0].newPriceCents, 0);
    assert.equal(page1.items[0].storeUrl, 'https://store.steampowered.com/app/1145360/');
    assert.equal(page1.nextCursor, String(aRows[1].id));
    const page2 = await (await get(`?limit=1&before=${page1.nextCursor}`, a.cookie)).json();
    assert.equal(page2.items[0].id, String(first.id));
    assert.equal(page2.nextCursor, null);
    assert.deepEqual((await (await get('', b.cookie)).json()).items.map((item: { id: string }) => item.id), [String(bRows[0].id)]);
    assert.equal((await mark(String(first.id), b.cookie)).status, 404);
    assert.equal((await mark(String(first.id), a.cookie, 'https://other.example')).status, 403);
    assert.deepEqual(await (await get('/unread', a.cookie)).json(), { count: 2 });
    assert.equal((await mark(String(first.id), a.cookie)).status, 204);
    const readAt = (await rows(a.id))[0].readAt;
    assert.ok(readAt);
    assert.equal((await mark(String(first.id), a.cookie)).status, 204);
    assert.deepEqual((await rows(a.id))[0].readAt, readAt);
    assert.deepEqual(await (await get('/unread', a.cookie)).json(), { count: 1 });
    assert.deepEqual(await (await get('/unread', b.cookie)).json(), { count: 1 });
  } finally {
    await app.close();
    try { await db.user.deleteMany({ where: { email: { in: emails } } }); }
    finally { await competitor.$disconnect(); await db.$disconnect(); }
  }
});
