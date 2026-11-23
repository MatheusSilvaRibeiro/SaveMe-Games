import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { DatabaseService } from '../src/database.js';

const testUrl = process.env.FAVORITES_TEST_DATABASE_URL;
const origin = 'http://127.0.0.1:5173';
const currentCookieName = 'saveme_session_api=';

test('favoritos isolam duas contas e mantêm sessão e escritas idempotentes', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.endsWith('_test'),
    'Use um PostgreSQL descartável de loopback e um banco com sufixo _test.');
  process.env.DATABASE_URL = testUrl;
  process.env.AUTH_ORIGINS = origin;
  process.env.JWT_SECRET = crypto.randomUUID();
  const db = new DatabaseService();
  const emails = [`a-${crypto.randomUUID()}@example.invalid`, `b-${crypto.randomUUID()}@example.invalid`];
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`;
    const payload = (cookie = '', requestOrigin = origin) => ({ Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' });
    async function register(email: string) {
      const response = await fetch(`${base}/auth/register`, {
        method: 'POST', headers: payload(), body: JSON.stringify({ name: 'Teste favoritos', email, password: 'senha-de-teste' }),
      });
      assert.equal(response.status, 201);
      const { user } = await response.json();
      const setCookies = response.headers.getSetCookie();
      const cookie = setCookies.find(value => value.startsWith(currentCookieName))!;
      assert.match(cookie, /; Path=\/api;/i);
      assert.ok(setCookies.some(value => /^saveme_session=; Path=\/api\/auth;/i.test(value)));
      return { id: user.id as string, cookie: cookie.split(';')[0] };
    }
    const list = (cookie = '') => fetch(`${base}/favorites`, { headers: { Cookie: cookie } });
    const write = (method: 'PUT' | 'DELETE', cookie = '', gameId = 'hades', requestOrigin = origin, body: unknown = {}) =>
      fetch(`${base}/favorites/${gameId}`, { method, headers: payload(cookie, requestOrigin), body: JSON.stringify(body) });
    const [a, b] = await Promise.all(emails.map(register));
    assert.equal((await list()).status, 401);
    assert.equal((await write('PUT')).status, 401);
    assert.equal((await write('DELETE')).status, 401);
    assert.equal((await write('PUT', a.cookie, 'hades', 'https://other.example')).status, 403);
    assert.equal((await fetch(`${base}/favorites/hades`, { method: 'PUT', headers: { Cookie: a.cookie, Origin: origin } })).status, 415);
    assert.equal((await write('PUT', a.cookie, 'INVALID')).status, 400);
    for (const method of ['PUT', 'DELETE'] as const) {
      assert.equal((await write(method, a.cookie, 'game-missing')).status, 404);
    }

    const repeated = await Promise.all([write('PUT', a.cookie, 'hades', origin, { userId: b.id }), write('PUT', a.cookie)]);
    assert.deepEqual(repeated.map(response => response.status), [204, 204]);
    const aList = await list(a.cookie);
    assert.match(aList.headers.get('cache-control')!, /no-store/);
    assert.deepEqual((await aList.json()).map((game: { id: string }) => game.id), ['hades']);
    assert.deepEqual(await (await list(b.cookie)).json(), []);
    assert.equal((await write('PUT', b.cookie)).status, 204);
    assert.equal(await db.favorite.count({ where: { gameId: 'hades', userId: { in: [a.id, b.id] } } }), 2);
    assert.equal((await write('DELETE', a.cookie, 'hades', 'https://other.example')).status, 403);
    assert.deepEqual((await Promise.all([write('DELETE', a.cookie), write('DELETE', a.cookie)])).map(response => response.status), [204, 204]);
    assert.deepEqual(await (await list(a.cookie)).json(), []);
    assert.equal((await (await list(b.cookie)).json()).length, 1);

    const legacyA = 'saveme_session=' + a.cookie.slice(currentCookieName.length);
    assert.equal((await list(legacyA)).status, 401);
    const me = (cookie: string) => fetch(`${base}/auth/me`, { headers: { Cookie: cookie } });
    const migrated = await me(legacyA);
    assert.equal((await migrated.json()).user.id, a.id);
    assert.ok(migrated.headers.getSetCookie().some(value => value.startsWith(a.cookie + ';') && /; Path=\/api;/.test(value)));
    assert.ok(migrated.headers.getSetCookie().some(value => /^saveme_session=; Path=\/api\/auth;/.test(value)));
    assert.equal((await (await me(`${legacyA}; ${b.cookie}`)).json()).user.id, b.id);
    const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: payload(a.cookie), body: '{}' });
    assert.equal(logout.status, 200);
    assert.ok(logout.headers.getSetCookie().some(value => /^saveme_session_api=; Path=\/api;/.test(value)));
    assert.ok(logout.headers.getSetCookie().some(value => /^saveme_session=; Path=\/api\/auth;/.test(value)));
    assert.equal((await list(a.cookie)).status, 401);
  } finally {
    await app.close();
    try { await db.user.deleteMany({ where: { email: { in: emails } } }); }
    finally { await db.$disconnect(); }
  }
});
