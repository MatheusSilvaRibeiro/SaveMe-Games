import { existsSync } from 'node:fs';
import { DatabaseService } from '../database.js';
import { collectPrices } from './collect-prices.js';

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
  const db = new DatabaseService();
  try {
    const result = await collectPrices(db);
    if (result.status === 'overlap') {
      console.error('Já existe uma coleta em execução para este banco.');
      process.exitCode = 2;
      return;
    }
    console.log(JSON.stringify(result));
    if (result.errors.length || result.unprocessed) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error && !('clientVersion' in error)
    ? error.message : 'Falha na coleta. Confira a conexão e as migrations do banco.');
  process.exitCode = 1;
});
