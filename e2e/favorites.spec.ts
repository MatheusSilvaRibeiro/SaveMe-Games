import { test, expect } from '@playwright/test';

const game = { id: 'hades', nome: 'Hades', edicao: 'Jogo base', plataforma: 'PC', imagem: 'https://images.example/hades.jpg', steam: { appId: 1145360 }, epic: { offerId: 'hades-offer', namespace: 'min' } };
const steam = { loja: 'Steam', situacao: 'disponivel', precoCentavos: 5000, moeda: 'BRL', link: 'https://store.steampowered.com/app/1145360/' };
const epic = { ...steam, loja: 'Epic Games Store', link: 'https://store.epicgames.com/pt-BR/p/hades' };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/comparisons/hades', route => route.fulfill({ json: {
    jogo: game, ofertas: [steam, epic], situacao: 'comparavel', menorPrecoCentavos: 5000, economiaCentavos: 0, lojasMenorPreco: ['Steam', 'Epic Games Store'],
  } }));
});

test('visitante recebe orientação de login ao tentar favoritar', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/#/comparacao/hades');
  await page.getByRole('button', { name: 'Favoritar', exact: true }).click();
  await expect(page.getByText('Entre na sua conta para favoritar.')).toBeVisible();
  await page.getByRole('link', { name: 'Ir para o login' }).click();
  await expect(page).toHaveURL(/#\/login$/);
});

test('busca compartilha o favorito entre Steam, Epic e a lista da conta', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'a', name: 'Conta A' } } }));
  await page.route('**/api/comparisons/games', route => route.fulfill({ json: [game] }));
  await page.route('**/api/steam/featured', route => route.fulfill({ json: {
    resultados: [{ appId: game.steam.appId, nome: game.nome, imagem: null }],
  } }));
  await page.route('**/api/steam/games/*', route => route.fulfill({ json: {
    ...steam, appId: game.steam.appId, nome: game.nome, tipo: 'game', regiao: 'BR',
    situacaoPreco: 'informado', consultadoEm: '2026-11-24T12:00:00Z',
  } }));
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: {
    resultados: [{ ...epic, fonte: 'EGData', id: game.epic.offerId, namespace: game.epic.namespace, nome: game.nome, imagem: null }],
    proximaPagina: null,
  } }));
  let saved = false;
  await page.route('**/api/favorites', route => route.fulfill({ json: saved ? [game] : [] }));
  await page.route('**/api/favorites/hades', route => {
    saved = route.request().method() === 'PUT';
    return route.fulfill({ status: 204 });
  });

  await page.goto('/#/busca');
  const steamCatalog = page.getByRole('region', { name: 'Resultados da busca' });
  await expect(steamCatalog.getByRole('link', { name: 'Comparar preços', exact: true })).toHaveAttribute('href', '#/comparacao/hades');
  await steamCatalog.getByRole('button', { name: 'Adicionar aos favoritos' }).click();
  await expect(steamCatalog.getByRole('button', { name: 'Adicionado aos favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toBeHidden();
  const epicCatalog = page.getByRole('region', { name: 'Jogos da Epic' });
  await expect(epicCatalog.getByRole('button', { name: 'Adicionado aos favoritos' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/#/favoritos');
  await expect(page.getByRole('heading', { name: 'Hades' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Jogos favoritos' }).locator('img')).toHaveAttribute('src', game.imagem);
  await page.goto('/#/busca');
  await epicCatalog.getByRole('button', { name: 'Adicionado aos favoritos' }).click();
  await expect(epicCatalog.getByRole('button', { name: 'Adicionar aos favoritos' })).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/#/favoritos');
  await expect(page.getByText('Você ainda não tem jogos favoritos.')).toBeVisible();
});

test('lista mostra carregamento, erro e tentativa até o estado vazio', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'a', name: 'Conta A' } } }));
  let release!: () => void;
  const firstRequest = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/favorites', async route => {
    await firstRequest;
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.goto('/#/favoritos');
  await expect(page.getByRole('status')).toHaveText('Carregando seus favoritos…');
  release();
  await expect(page.getByRole('alert')).toHaveText('Não foi possível carregar seus favoritos.');
  await page.route('**/api/favorites', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Você ainda não tem jogos favoritos.')).toBeVisible();
});

test('sessão antiga migra no navegador e favoritos persistem até a remoção @favorites-db', async ({ page, context }) => {
  const testUrl = process.env.FAVORITES_TEST_DATABASE_URL;
  test.skip(!testUrl, 'Requer PostgreSQL descartável migrado e com catálogo carregado.');
  const target = new URL(testUrl!);
  expect(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname.endsWith('_test')).toBe(true);
  const registration = await page.request.post('/api/auth/register', { data: {
    name: 'Teste navegador', email: `favorites-${crypto.randomUUID()}@example.invalid`, password: 'senha-de-teste',
  } });
  expect(registration.status()).toBe(201);
  const current = (await context.cookies()).find(cookie => cookie.name === 'saveme_session_api')!;
  expect(current.path).toBe('/api');
  await context.clearCookies({ name: current.name });
  await context.addCookies([{ ...current, name: 'saveme_session', path: '/api/auth' }]);
  await page.goto('/#/comparacao/hades');
  const add = page.getByRole('button', { name: 'Favoritar', exact: true });
  await add.click();
  await expect(page.getByRole('button', { name: 'Adicionado aos favoritos' })).toBeVisible();
  expect((await context.cookies()).map(cookie => cookie.name)).toEqual(['saveme_session_api']);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Favoritos' }).click();
  await expect(page.getByRole('list', { name: 'Jogos favoritos' })).toContainText('Hades');
  await page.reload();
  await expect(page.getByRole('list', { name: 'Jogos favoritos' })).toContainText('Hades');
  await page.getByRole('button', { name: 'Remover Hades dos favoritos' }).click();
  await expect(page.getByText('Você ainda não tem jogos favoritos.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/#\/login$/);
  expect((await context.cookies()).filter(cookie => cookie.name.startsWith('saveme_session'))).toHaveLength(0);
});
