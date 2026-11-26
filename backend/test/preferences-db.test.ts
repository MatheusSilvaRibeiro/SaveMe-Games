import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { DatabaseService } from '../src/database.js';
import { persistPriceObservations } from '../src/comparison/price-observation.js';
const url = process.env.PREFERENCES_TEST_DATABASE_URL;
test('preferencias persistem por conta e bloqueiam novos avisos sem retroatividade', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.pathname.endsWith('_test'));
  process.env.DATABASE_URL = url; process.env.JWT_SECRET = crypto.randomUUID();
  const origin = 'http://127.0.0.1:5173'; process.env.AUTH_ORIGINS = origin;
  const db = new DatabaseService(), app = await createApp();
  const emails = [0, 1].map(() => `prefs-${crypto.randomUUID()}@example.invalid`);
  const oldUsers = await db.user.count();
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api`;
    async function register(email: string) {
      const r = await fetch(`${base}/auth/register`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Teste preferencias', email, password: 'senha-de-teste' }) });
      assert.equal(r.status, 201); const { user } = await r.json();
      return { id: user.id as string, cookie: r.headers.getSetCookie().find(x => x.startsWith('saveme_session_api='))!.split(';')[0] };
    }
    const [a, b] = await Promise.all(emails.map(register));
    const get = (cookie = '') => fetch(`${base}/preferences`, { headers: { Cookie: cookie } });
    const patch = (cookie: string, body: unknown, source = origin) => fetch(`${base}/preferences`, { method: 'PATCH', headers: { Cookie: cookie, Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await get()).status, 401);
    assert.equal((await patch('', { priceAlertsEnabled: false })).status, 401);
    assert.equal((await patch(a.cookie, { priceAlertsEnabled: false }, 'https://other.example')).status, 403);
    assert.equal((await patch(a.cookie, { priceAlertsEnabled: 'false' })).status, 400);
    assert.equal((await patch(a.cookie, { priceAlertsEnabled: false, userId: b.id })).status, 400);
    assert.deepEqual(await (await get(a.cookie)).json(), { priceAlertsEnabled: true });
    assert.equal((await patch(a.cookie, { priceAlertsEnabled: false })).status, 200);
    assert.deepEqual(await (await get(a.cookie)).json(), { priceAlertsEnabled: false });
    assert.deepEqual(await (await get(b.cookie)).json(), { priceAlertsEnabled: true });
    const start = Date.now() - 4000;
    for (const user of [a, b]) await db.favorite.create({ data: { userId: user.id, gameId: 'hades', createdAt: new Date(start - 1000) } });
    const offer = await db.storeOffer.findUniqueOrThrow({ where: { gameId_storeCode: { gameId: 'hades', storeCode: 'steam' } } });
    const observe = (price: bigint, offset: number) => db.$transaction(tx => persistPriceObservations(tx, [{ offerId: offer.id, region: 'BR', currency: 'BRL', state: 'available', priceCents: price, collectedAt: new Date(start + offset) }]));
    await observe(5000n, 0); await observe(4000n, 1000);
    assert.equal(await db.priceAlert.count({ where: { userId: a.id } }), 0);
    assert.equal(await db.priceAlert.count({ where: { userId: b.id } }), 1);
    await patch(a.cookie, { priceAlertsEnabled: true });
    assert.equal(await db.priceAlert.count({ where: { userId: a.id } }), 0);
    await observe(3000n, 2000);
    assert.equal(await db.priceAlert.count({ where: { userId: a.id } }), 1);
    assert.equal(await db.priceAlert.count({ where: { userId: b.id } }), 2);
  } finally {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    assert.equal(await db.user.count(), oldUsers);
    await app.close(); await db.$disconnect();
  }
});
