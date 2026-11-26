import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { DatabaseService } from '../src/database.js';
import { hashPassword, verifyPassword } from '../src/auth.js';
import { BrevoRecoveryMailer, resetHash } from '../src/recovery.js';

test('email exige configuracao HTTPS valida e nao expoe segredos', () => {
  const original = { ...process.env };
  try {
    delete process.env.BREVO_API_KEY; assert.equal(new BrevoRecoveryMailer().configured(), false);
    process.env.BREVO_API_KEY = 'test'; process.env.MAIL_FROM = 'test@example.invalid';
    process.env.PUBLIC_WEB_URL = 'http://unsafe.example'; assert.equal(new BrevoRecoveryMailer().configured(), false);
    process.env.PUBLIC_WEB_URL = 'https://saveme-games.vercel.app'; assert.equal(new BrevoRecoveryMailer().configured(), true);
  } finally { process.env = original; }
});
test('API de e-mail usa HTTPS, destinatario correto e rejeita falha do provedor', async () => {
  const originalFetch = globalThis.fetch; const original = { ...process.env };
  try {
    process.env.BREVO_API_KEY = 'test-key'; process.env.MAIL_FROM = 'sender@example.invalid';
    let status = 201;
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal((init.headers as Record<string, string>)['api-key'], 'test-key');
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body.to, [{ email: 'recipient@example.invalid' }]);
      assert.deepEqual(body.sender, { email: 'sender@example.invalid', name: 'SaveMe Games' });
      assert.ok(body.textContent.includes('https://app.example/#/redefinir-senha?token=test'));
      return new Response('{}', { status });
    }) as typeof fetch;
    const mailer = new BrevoRecoveryMailer();
    await mailer.send('recipient@example.invalid', 'https://app.example/#/redefinir-senha?token=test');
    status = 403;
    await assert.rejects(() => mailer.send('recipient@example.invalid', 'https://app.example/#/redefinir-senha?token=test'), /MAIL_DELIVERY_FAILED/);
  } finally { globalThis.fetch = originalFetch; process.env = original; }
});
const url = process.env.RECOVERY_TEST_DATABASE_URL;
test('recuperacao: hash, uso unico concorrente, expiracao e revogacao de sessoes', { skip: !url }, async () => {
  const parsed = new URL(url!); assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.pathname.endsWith('_test'));
  process.env.DATABASE_URL = url; process.env.PUBLIC_WEB_URL = 'http://127.0.0.1:5173';
  process.env.AUTH_ORIGINS = 'http://127.0.0.1:5173'; process.env.JWT_SECRET = crypto.randomUUID();
  const deliveries: { email: string; link: string }[] = [];
  let configured = true;
  const app = await createApp(undefined, undefined, undefined, { configured: () => configured, send: async (email, link) => { deliveries.push({ email, link }); } });
  const db = new DatabaseService(); const email = `recovery-${crypto.randomUUID()}@example.invalid`;
  const user = await db.user.create({ data: { name: 'Teste', email, passwordHash: await hashPassword('old-password') } });
  const other = await db.user.create({ data: { name: 'Outra', email: `other-${email}`, passwordHash: await hashPassword('unchanged-password') } });
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/auth`;
    const post = (path: string, body: unknown, origin = process.env.AUTH_ORIGINS!) => fetch(`${base}/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    configured = false; assert.equal((await post('forgot-password', { email })).status, 503); configured = true;
    assert.equal((await post('forgot-password', { email }, 'https://bad.example')).status, 403);
    const unknown = await post('forgot-password', { email: 'unknown@example.invalid' }); assert.equal(unknown.status, 200);
    const known = await post('forgot-password', { email: email.toUpperCase() }); assert.equal(known.status, 200);
    assert.deepEqual(await known.json(), await unknown.json()); assert.equal(deliveries.length, 1);
    const token = deliveries[0].link.split('token=')[1]; assert.match(token, /^[a-f0-9]{64}$/);
    const row = await db.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: resetHash(token) } });
    assert.notEqual(row.tokenHash, token); assert.equal(row.userId, user.id);
    assert.ok(row.expiresAt.getTime() - Date.now() > 14 * 60000);
    await post('forgot-password', { email }); assert.equal(deliveries.length, 1);
    const login = await post('login', { email, password: 'old-password' }); assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find(x => x.startsWith('saveme_session_api='))!.split(';')[0];
    const changes = await Promise.all([0, 1].map(() => post('reset-password', { token, password: 'new-password' })));
    assert.deepEqual(changes.map(r => r.status).sort(), [200, 400]);
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: cookie } })).status, 401);
    assert.equal((await post('login', { email, password: 'old-password' })).status, 401);
    assert.equal((await post('login', { email, password: 'new-password' })).status, 200);
    assert.equal(await verifyPassword('unchanged-password', (await db.user.findUniqueOrThrow({ where: { id: other.id } })).passwordHash), true);
    const expired = 'a'.repeat(64);
    await db.passwordResetToken.create({ data: { tokenHash: resetHash(expired), userId: user.id, expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await post('reset-password', { token: expired, password: 'changed-again' })).status, 400);
    assert.equal((await post('reset-password', { token, password: 'changed-again' })).status, 400);
    await post('forgot-password', { email });
    await post('forgot-password', { email });
    assert.equal((await post('forgot-password', { email })).status, 429);
  } finally { await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } }); await app.close(); await db.$disconnect(); }
});
