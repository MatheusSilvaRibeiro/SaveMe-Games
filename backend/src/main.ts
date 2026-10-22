import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('backend/.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
else if (existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  const port = Number(process.env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT inválida.');
  const app = await createApp();
  await app.listen(port, '127.0.0.1');
  console.log(`SaveMe API: http://127.0.0.1:${port}/api/health`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
