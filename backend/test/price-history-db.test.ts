import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { collectPrices } from '../src/comparison/collect-prices.js';
import type { OfferIdentity } from '../src/comparison/service.js';
import { DatabaseService } from '../src/database.js';

const url = process.env.HISTORY_TEST_DATABASE_URL;

test('coleta com fontes simuladas e histórico HTTP em PostgreSQL', { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname.endsWith('_test'),
    'Use PostgreSQL de loopback e um banco descartável com sufixo _test.');
  process.env.DATABASE_URL = url;
  const db = new DatabaseService();
  const competitor = new DatabaseService();
  const now = Date.now();
  const time = (round: number) => new Date(now - (8 - round) * 60000).toISOString();
  const sourceDate = new Date(now - 86400000).toISOString();
  const ancient = new Date(now - 2 * 86400000).toISOString();
  let active = 0;
  let maxActive = 0;

  async function fixture(identity: OfferIdentity, round: number) {
    const steam = identity.store === 'steam';
    const hades = steam ? identity.appId === 1145360 : identity.namespace === 'min';
    const cents = round === 5 ? null : [5000, 5000, 5000, 3000, 0, 0, 2500][round] ?? 5000;
    if (hades && !steam && round === 6) throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
    const data = {
      regiao: 'BR', moeda: 'BRL', precoCentavos: hades && steam ? cents : 6000,
      situacaoPreco: hades && steam && round === 4 ? 'gratuito' : 'informado',
      consultadoEm: round === 0 ? ancient : time(round),
    };
    if (round === 7 && hades) return steam
      ? { ...data, tipo: 'dlc', appId: identity.appId }
      : { ...data, id: identity.offerId, namespace: 'other', tipoOferta: 'BASE_GAME' };
    return steam ? { ...data, tipo: 'game', appId: identity.appId }
      : { ...data, id: identity.offerId, namespace: identity.namespace, tipoOferta: 'BASE_GAME', registroPrecoEm: sourceDate };
  }

  async function run(round: number) {
    const result = await collectPrices(db, async identity => {
      active++;
      maxActive = Math.max(maxActive, active);
      try { await delay(5); return await fixture(identity, round); }
      finally { active--; }
    });
    if (result.status !== 'completed') assert.fail('A coleta deveria executar.');
    return result;
  }

  try {
    for (const round of [0, 1, 2, 3, 4, 5]) assert.equal((await run(round)).inserted, 10);
    assert.equal(maxActive, 3);
    const partial = await run(6);
    assert.equal(partial.inserted, 9);
    assert.deepEqual(partial.errors, [{ gameId: 'hades', store: 'epic', reason: 'NETWORK_ERROR' }]);
    const repeated = await run(5);
    assert.equal(repeated.inserted, 0);
    assert.equal(repeated.duplicates, 10);
    assert.equal((await run(7)).errors.length, 2);

    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const running = collectPrices(db, async identity => { entered(); await release; return fixture(identity, 5); });
    try {
      await started;
      assert.deepEqual(await collectPrices(competitor, () => assert.fail('Uma coleta sobreposta consultou a fonte.')), { status: 'overlap' });
    } finally {
      resume();
      await running;
    }
    assert.equal((await run(5)).duplicates, 10);

    const app = await createApp();
    try {
      await app.listen(0, '127.0.0.1');
      const base = `${await app.getUrl()}/api/comparisons/history`;
      const response = await fetch(`${base}/hades?days=1`);
      assert.equal(response.status, 200);
      const history = await response.json();
      assert.equal(history.gameId, 'hades');
      assert.equal(history.region, 'BR');
      assert.equal(history.currency, 'BRL');
      const [steam, epic] = history.series;
      assert.equal(steam.store, 'steam');
      assert.equal(epic.store, 'epic');
      assert.deepEqual(steam.points.map((p: { priceCents: number | null }) => p.priceCents), [5000, 5000, 3000, 0, null, 2500]);
      assert.deepEqual(steam.points.map((p: { collectedAt: string }) => p.collectedAt), [1, 2, 3, 4, 5, 6].map(time));
      assert.equal(steam.points[4].state, 'price_missing');
      assert.equal(epic.points.length, 5);
      assert.equal(epic.points[4].sourceRecordedAt, sourceDate);
      assert.equal(epic.points[4].collectedAt, time(5));
      const limited = await (await fetch(`${base}/hades?days=1&limit=2`)).json();
      assert.deepEqual(limited.series[0].points.map((p: { collectedAt: string }) => p.collectedAt), [time(5), time(6)]);
      assert.equal(limited.series[1].points.length, 2);
      assert.equal((await fetch(`${base}/unknown`)).status, 404);
      for (const suffix of ['hades?days=366', 'hades?limit=501', 'hades?limit=1.5', 'hades?days=1&days=2', 'INVALID']) {
        assert.equal((await fetch(`${base}/${suffix}`)).status, 400);
      }
    } finally { await app.close(); }
  } finally {
    await competitor.$disconnect();
    await db.$disconnect();
  }
});
