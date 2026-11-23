// A configuração é carregada antes de importar a API e seus módulos.
import { existsSync } from 'node:fs';
if (existsSync('backend/.env')) process.loadEnvFile('backend/.env');
else if (existsSync('.env')) process.loadEnvFile('.env');
process.env.NODE_ENV ??= 'production';
process.env.API_HOST ??= '0.0.0.0';
process.env.SERVE_WEB ??= 'true';
await import('../backend/dist/backend/src/main.js');
