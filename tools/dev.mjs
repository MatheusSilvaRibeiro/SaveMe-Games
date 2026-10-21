import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Porta ${port} ocupada. Feche o servidor anterior antes de executar npm run dev.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

export async function startDevelopment({ apiPort = Number(process.env.API_PORT ?? 3000), webPort = Number(process.env.WEB_PORT ?? 5173) } = {}) {
  for (const port of [apiPort, webPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta de desenvolvimento inválida.');
  }
  if (apiPort === webPort) throw new Error('Site e API precisam de portas diferentes.');
  if (!existsSync(join(root, 'backend/node_modules/@nestjs/core/package.json')) || !existsSync(join(root, 'node_modules/vite/bin/vite.js'))) {
    throw new Error('Dependências incompletas. Execute npm run setup na raiz do repositório.');
  }
  await checkPort(apiPort);
  await checkPort(webPort);
  const children = new Set();
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    await Promise.all([...children].map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill();
    })));
  }
  const onSignal = () => { void stop(); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  function launch(args, cwd, managed = true) {
    const child = spawn(process.execPath, args, {
      cwd, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, API_PORT: String(apiPort), WEB_PORT: String(webPort) },
    });
    children.add(child);
    child.once('exit', code => {
      children.delete(child);
      if (managed && !stopping) {
        console.error(`Um serviço encerrou (código ${code ?? 'desconhecido'}). Encerrando o outro.`);
        process.exitCode = code || 1;
        void stop();
      }
    });
    return child;
  }

  try {
    console.log('Preparando API do SaveMe…');
    const build = launch(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], join(root, 'backend'), false);
    await new Promise((resolve, reject) => {
      build.once('error', reject);
      build.once('exit', code => code === 0 ? resolve() : reject(new Error('A compilação da API falhou. Confira a mensagem acima.')));
    });
    if (stopping) return { stop };
    const api = launch(['dist/backend/src/main.js'], join(root, 'backend'));
    const deadline = Date.now() + 20000;
    let ready = false;
    while (!stopping && Date.now() < deadline) {
      if (api.exitCode !== null) throw new Error('A API encerrou antes de iniciar.');
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok && (await response.json()).service === 'saveme-api') { ready = true; break; }
      } catch { /* Aguarda o processo iniciar, sem consultar a Steam. */ }
      await delay(200);
    }
    if (!ready) throw new Error('A API não iniciou no prazo esperado. O site não foi iniciado.');
    launch(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], root);
    console.log(`API pronta em http://127.0.0.1:${apiPort}. Iniciando site em http://127.0.0.1:${webPort}/#/busca`);
    console.log('Mantenha este terminal aberto. Ctrl+C encerra site e API.');
    return { stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDevelopment().catch(error => { console.error(error.message); process.exitCode = 1; });
}
