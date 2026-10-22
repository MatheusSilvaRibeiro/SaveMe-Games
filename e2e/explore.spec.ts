import { test, expect } from '@playwright/test';

const common = { imagem: null, sistemas: ['Windows'], metacritic: null, tipo: 'game', loja: 'Steam', regiao: 'BR', moeda: 'BRL', consultadoEm: '2026-10-20T20:00:00Z' };
const games = [
  { ...common, appId: 570, nome: 'Dota 2', precoCentavos: 0, situacaoPreco: 'gratuito', generos: ['Estratégia'] },
  { ...common, appId: 620, nome: 'Portal 2', precoCentavos: 3399, situacaoPreco: 'informado', generos: ['Ação', 'Aventura'] },
  { ...common, appId: 999, nome: 'Preço desconhecido', precoCentavos: null, situacaoPreco: 'indisponivel', generos: [] },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [], proximaPagina: null } }));
  await page.route('**/api/steam/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const game = games.find(item => path.endsWith(`/${item.appId}`));
    return route.fulfill({ json: game ?? { termo: '', resultados: games } });
  });
});

test('entrada mostra seleção e identifica grátis sem abrir popup', async ({ page }) => {
  await page.goto('/#/busca');
  await expect(page.getByRole('heading', { name: 'Explore a Steam' })).toBeVisible();
  const free = page.getByRole('button', { name: /Dota 2.*Ver oferta na Steam/ });
  await expect(free).toContainText('Gratuito');
  await expect(free).not.toContainText('Preço sob consulta');
  await expect(page.getByRole('button', { name: /Preço desconhecido.*Ver oferta/ })).toContainText('Preço sob consulta');
});

test('combina gênero e preço, trata interseção vazia e limpa filtros', async ({ page }) => {
  await page.goto('/#/busca');
  await page.getByLabel('Gênero', { exact: true }).selectOption('Ação');
  await expect(page.getByRole('button', { name: /Portal 2.*Ver oferta/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toHaveCount(0);
  await page.getByLabel('Preço', { exact: true }).selectOption('free');
  await expect(page.getByText('Nenhum título corresponde aos filtros.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toBeVisible();
  await page.getByLabel('Preço', { exact: true }).selectOption('free');
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Preço desconhecido.*Ver oferta/ })).toHaveCount(0);
});

test('pesquisa reinicia filtros e permite voltar à seleção', async ({ page }) => {
  await page.goto('/#/busca');
  await page.getByLabel('Preço', { exact: true }).selectOption('free');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByLabel('Preço', { exact: true })).toHaveValue('all');
  await page.getByRole('button', { name: 'Explorar jogos' }).click();
  await expect(page.getByRole('heading', { name: 'Explore a Steam' })).toBeVisible();
});

test('seleção e filtros cabem em tela de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/busca');
  await expect(page.getByLabel('Gênero', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('falha da seleção não impede pesquisar', async ({ page }) => {
  await page.route('**/api/steam/featured', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/#/busca');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Qual jogo você está procurando?').fill('Dota');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});


test('carrega mais sem duplicatas e preserva os cards se uma página falhar', async ({ page }) => {
  let failMore = true;
  await page.route('**/api/steam/featured*', async route => {
    const secondPage = new URL(route.request().url()).searchParams.get('page') === '2';
    if (secondPage && failMore) { failMore = false; return route.fulfill({ status: 503, json: {} }); }
    return route.fulfill({ json: { termo: '', resultados: secondPage ? [games[0], { ...games[1], appId: 1000, nome: 'Outro jogo' }] : games, proximaPagina: secondPage ? null : 2 } });
  });
  await page.goto('/#/busca');
  await expect(page.getByPlaceholder('Buscar jogos por nome')).toBeVisible();
  await expect(page.getByText('Digite ao menos 2 caracteres e pressione Enter ou Buscar.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Carregar mais jogos' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toBeVisible();
  await page.getByRole('button', { name: 'Carregar mais jogos' }).click();
  await expect(page.getByRole('button', { name: /Outro jogo.*Ver oferta/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dota 2.*Ver oferta/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Carregar mais jogos' })).toHaveCount(0);
});
