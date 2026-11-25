import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { collectPrices } from '../src/comparison/collect-prices.js';
import type { OfferIdentity } from '../src/comparison/service.js';
import { DatabaseService } from '../src/database.js';

const testUrl = process.env.INTEGRATED_TEST_DATABASE_URL;
const origin = 'http://127.0.0.1:5173';

test('conta, favorito, coleta, histórico e aviso compartilham o mesmo banco', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.endsWith('_test'));
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = crypto.randomUUID();
  process.env.AUTH_ORIGINS = origin;
  const db = new DatabaseService();
  const emails = Array.from({ length: 2 }, () => `integration-${crypto.randomUUID()}@example.invalid`);
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`;
    const get = (path: string, cookie = '') => fetch(`${base}${path}`, { headers: { Cookie: cookie } });
    const write = (method: string, path: string, cookie = '', body: unknown = {}) => fetch(`${base}${path}`, {
      method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const cookieFrom = (response: Response) =>
      response.headers.getSetCookie().find(value => value.startsWith('saveme_session_api='))!.split(';')[0];
    for (const email of emails) {
      assert.equal((await write('POST', '/auth/register', '', { email, name: 'Conta de teste', password: 'senha-de-teste' })).status, 201);
    }
    async function login(email: string) {
      const response = await write('POST', '/auth/login', '', { email, password: 'senha-de-teste' });
      assert.equal(response.status, 200);
      return { cookie: cookieFrom(response), user: (await response.json()).user };
    }
    const [owner, other] = await Promise.all(emails.map(login));
    assert.equal((await get('/auth/me', owner.cookie)).status, 200);
    assert.equal((await write('PUT', '/favorites/hades', owner.cookie)).status, 204);
    assert.deepEqual((await (await get('/favorites', owner.cookie)).json()).map((game: { id: string }) => game.id), ['hades']);
    assert.deepEqual(await (await get('/favorites', other.cookie)).json(), []);

    const favorite = await db.favorite.findUniqueOrThrow({ where: { userId_gameId: { userId: owner.user.id, gameId: 'hades' } } });
    const times = [1, 2].map(offset => new Date(favorite.createdAt.getTime() + offset).toISOString());
    await delay(20);
    for (const [round, collectedAt] of times.entries()) {
      const result = await collectPrices(db, async (identity: OfferIdentity) => identity.store === 'steam'
        ? { appId: identity.appId, tipo: 'game', regiao: 'BR', moeda: 'BRL', situacaoPreco: 'informado', consultadoEm: collectedAt,
          precoCentavos: identity.appId === 1145360 && round === 1 ? 4000 : 5000 }
        : { id: identity.offerId, namespace: identity.namespace, tipoOferta: 'BASE_GAME', regiao: 'BR', moeda: 'BRL',
          situacaoPreco: 'informado', consultadoEm: collectedAt, precoCentavos: 6000 });
      if (result.status !== 'completed') assert.fail('Coleta bloqueada.');
      assert.equal(result.inserted, 10);
      assert.deepEqual(result.errors, []);
      if (round === 0) assert.deepEqual(await (await get('/alerts/unread', owner.cookie)).json(), { count: 0 });
    }
    const historyResponse = await get('/comparisons/history/hades');
    assert.equal(historyResponse.status, 200);
    const { series } = await historyResponse.json();
    assert.deepEqual(series.map(({ store, points }: { store: string; points: { priceCents: number; collectedAt: string }[] }) =>
      [store, points.map(point => point.priceCents), points.map(point => point.collectedAt)]),
    [['steam', [5000, 4000], times], ['epic', [6000, 6000], times]]);
    const listing = await get('/alerts', owner.cookie);
    assert.equal(listing.status, 200);
    const { items } = await listing.json();
    assert.equal(items.length, 1);
    const [alert] = items;
    assert.deepEqual([alert.store, alert.gameId, alert.previousPriceCents, alert.newPriceCents, alert.observedAt, alert.readAt],
      ['steam', 'hades', 5000, 4000, times[1], null]);
    assert.deepEqual((await (await get('/alerts', other.cookie)).json()).items, []);
    assert.equal((await write('PATCH', `/alerts/${alert.id}/read`, other.cookie)).status, 404);
    assert.equal((await write('PATCH', `/alerts/${alert.id}/read`, owner.cookie)).status, 204);
    const reloaded = await login(emails[0]);
    const { items: [saved] } = await (await get('/alerts', reloaded.cookie)).json();
    assert.equal(saved.id, alert.id);
    assert.ok(saved.readAt);
    assert.deepEqual(await (await get('/alerts/unread', reloaded.cookie)).json(), { count: 0 });
    assert.equal((await write('POST', '/auth/logout', reloaded.cookie)).status, 200);
    for (const path of ['/auth/me', '/favorites', '/alerts', '/alerts/unread']) {
      assert.equal((await get(path, reloaded.cookie)).status, 401);
      assert.equal((await get(path)).status, 401);
    }
  } finally {
    await app.close();
    try { await db.user.deleteMany({ where: { email: { in: emails } } }); }
    finally { await db.$disconnect(); }
  }
});
