import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

for (const portVariable of ['PORT', 'API_PORT']) {
  test(`produção usa ${portVariable} para servir site, assets e API sem Vite`, { timeout: 30000 }, async () => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));

    const origin = 'https://saveme.example';
    const catalogDatabase = process.env.CATALOG_TEST_DATABASE_URL;
    const env = {
      ...process.env,
      API_HOST: '127.0.0.1',
      API_PORT: 'invalid',
      AUTH_ORIGINS: origin,
      DATABASE_URL: catalogDatabase ?? '',
      NODE_ENV: 'production',
      SERVE_WEB: 'true',
      TRUST_PROXY_HOPS: '0',
    };
    delete env.PORT;
    env[portVariable] = String(port);
    const child = spawn(process.execPath, ['tools/start-production.mjs'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', data => logs += data);
    child.stderr.on('data', data => logs += data);
    const stopped = once(child, 'exit');
    const base = `http://127.0.0.1:${port}`;

    try {
      let service;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`API encerrou: ${logs}`);
        try {
          const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
          if (response.ok) service = (await response.json()).service;
        } catch { /* Aguarda a API começar a escutar. */ }
        if (service) break;
        await delay(100);
      }
      assert.equal(service, 'saveme-api', logs);

      const page = await fetch(base);
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type'), /^text\/html/);
      const html = await page.text();
      assert.match(html, /<div id="root">/);

      const script = html.match(/src="([^"]+\.js)"/)?.[1];
      const stylesheet = html.match(/href="([^"]+\.css)"/)?.[1];
      assert.ok(script && stylesheet, 'O HTML deve referenciar JavaScript e CSS compilados.');
      for (const [path, contentType] of [[script, /javascript/], [stylesheet, /text\/css/]]) {
        const asset = await fetch(new URL(path, base));
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get('content-type'), contentType);
        await asset.arrayBuffer();
      }

      const catalog = await fetch(`${base}/api/comparisons/games`);
      if (catalogDatabase) {
        assert.equal(catalog.status, 200);
        const games = await catalog.json();
        assert.deepEqual(games.map(game => game.id).sort(), ['among-us', 'celeste', 'dead-cells', 'hades', 'hades-ii']);
      } else {
        assert.equal(catalog.status, 503);
        assert.equal((await catalog.json()).code, 'CATALOG_UNAVAILABLE');
      }
      assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 404);
      assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);

      const preflight = await fetch(`${base}/api/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    } finally {
      child.kill();
      await stopped;
    }
  });
}
