import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { startDevelopment } from './dev.mjs';

test('porta ocupada é informada antes de iniciar serviços', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(startDevelopment({ apiPort: server.address().port, webPort: 5174 }), /ocupada/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('comando conjunto inicia API, site e proxy; encerra os dois', { timeout: 45000 }, async () => {
  const services = await startDevelopment({ apiPort: 3101, webPort: 5174 });
  try {
    let body;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:5174/api/health', { signal: AbortSignal.timeout(1000) });
        if (response.ok) { body = await response.json(); break; }
      } catch { /* Aguarda o site iniciar; a API já foi verificada pelo comando. */ }
      await delay(200);
    }
    assert.equal(body?.service, 'saveme-api');
    assert.equal((await fetch('http://127.0.0.1:5174/')).status, 200);
  } finally { await services.stop(); }
  await assert.rejects(fetch('http://127.0.0.1:3101/api/health', { signal: AbortSignal.timeout(1000) }));
  await assert.rejects(fetch('http://127.0.0.1:5174/', { signal: AbortSignal.timeout(1000) }));
});
