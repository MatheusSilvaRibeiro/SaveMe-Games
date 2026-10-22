import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DatabaseService } from '../src/database.js';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/auth.js';

test('senhas usam salt aleatório e verificam o hash', async () => {
  const first = await hashPassword('senha-de-teste');
  const second = await hashPassword('senha-de-teste');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('senha-de-teste', first), true);
  assert.equal(await verifyPassword('outra-senha', first), false);
});

test('cadastro, login e revogação de sessão no PostgreSQL', { skip: process.env.AUTH_DB_TEST !== '1' }, async () => {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const db = new DatabaseService();
  const email = `auth-test-${crypto.randomUUID()}@example.com`;
  const app = await createApp();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = (route: string, body: unknown, cookie = '', origin = 'http://127.0.0.1:5173') => fetch(`${base}/api/auth/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin }, body: JSON.stringify(body) });
  const me = (cookie = '') => fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  try {
    assert.equal((await me()).status, 401);
    assert.equal((await post('register', { name: 'Teste', email, password: 'curta' })).status, 400);
    assert.equal((await post('register', { name: 'Teste', email, password: 'senha-de-teste' }, '', 'https://other.example')).status, 403);
    const registration = await post('register', { name: 'Teste', email: email.toUpperCase(), password: 'senha-de-teste' });
    assert.equal(registration.status, 201);
    const registered = await registration.json() as { user: { email: string; passwordHash?: string } };
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.passwordHash, undefined);
    const setCookie = registration.headers.get('set-cookie')!;
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = setCookie.split(';')[0];
    assert.equal((await me(cookie)).status, 200);
    assert.equal((await post('register', { name: 'Outro', email, password: 'senha-de-teste' })).status, 409);
    assert.equal((await post('login', { email, password: 'senha-incorreta' })).status, 401);
    const login = await post('login', { email, password: 'senha-de-teste' });
    assert.equal(login.status, 200);
    const loginCookie = login.headers.get('set-cookie')!.split(';')[0];
    const persisted = await db.user.findUniqueOrThrow({ where: { email } });
    assert.notEqual(persisted.passwordHash, 'senha-de-teste');
    assert.equal(await verifyPassword('senha-de-teste', persisted.passwordHash), true);
    const invalid = jwt.sign({}, process.env.JWT_SECRET!, { subject: persisted.id, jwtid: crypto.randomUUID(), issuer: 'saveme-api', audience: 'saveme-web', expiresIn: -1 });
    assert.equal((await me(`saveme_session=${invalid}`)).status, 401);
    assert.equal((await post('logout', {}, loginCookie)).status, 200);
    assert.equal((await me(loginCookie)).status, 401);
    const payload = jwt.decode(cookie.slice('saveme_session='.length)) as jwt.JwtPayload;
    await db.session.update({ where: { id: payload.jti }, data: { expiresAt: new Date(0) } });
    assert.equal((await me(cookie)).status, 401);
    for (let index = 0; index < 20; index++) await post('login', { email, password: 'senha-incorreta' });
    assert.equal((await post('login', { email, password: 'senha-de-teste' })).status, 429);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await app.close();
    await db.$disconnect();
  }
});
