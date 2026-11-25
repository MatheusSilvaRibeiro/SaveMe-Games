import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = resolve('backend/.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
else if (existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT/API_PORT inválida.');
  const host = process.env.API_HOST ?? '127.0.0.1';
  const proxyHops = process.env.TRUST_PROXY_HOPS ?? '0';
  if (!/^\d+$/.test(proxyHops) || Number(proxyHops) > 10) throw new Error('TRUST_PROXY_HOPS inválido.');
  const directory = process.env.SERVE_WEB === 'true'
    ? fileURLToPath(new URL('../../../public/', import.meta.url))
    : undefined;
  if (directory && !existsSync(resolve(directory, 'index.html'))) {
    throw new Error('Site não compilado. Execute npm run build:production na raiz.');
  }
  const app = await createApp();
  app.set('trust proxy', Number(proxyHops));
  if (directory) app.useStaticAssets(directory);
  try {
    await app.listen(port, host);
  } catch (error) {
    await app.close();
    throw error;
  }
  console.log(`SaveMe API: http://${host}:${port}/api/health`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
