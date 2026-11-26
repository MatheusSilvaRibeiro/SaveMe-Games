import { test, expect } from '@playwright/test';
const items = [
 { appId: 1145360, nome: 'Hades', tipo: 'game', imagem: null, precoCentavos: 2000, precoOriginalCentavos: 8000, descontoPercentual: 75, generos: ['RPG'], destaques: ['top_sellers', 'specials'] },
 { appId: 2, nome: 'Jogo caro', tipo: 'game', imagem: null, precoCentavos: 15000, generos: ['Aventura'], destaques: ['top_sellers'] },
 { appId: 3, nome: 'Jogo gratis', tipo: 'game', imagem: null, precoCentavos: 0, generos: ['RPG'], destaques: ['specials'] },
 { appId: 4, nome: 'Jogo sem preco', tipo: 'game', imagem: null, precoCentavos: null, generos: ['Aventura'], destaques: ['new_releases'] },
 { appId: 5, nome: 'DLC excluido', tipo: 'dlc', imagem: null, precoCentavos: 100, generos: [], destaques: ['specials'] },
];
test.beforeEach(async ({ page }) => {
 await page.route('**/api/**', r => {
  const path = new URL(r.request().url()).pathname;
  if (path === '/api/health') return r.fulfill({ json: { status: 'ok', service: 'saveme-api' } });
  if (path === '/api/auth/me') return r.fulfill({ status: 401, json: {} });
  if (path === '/api/steam/featured') return r.fulfill({ json: { resultados: items, proximaPagina: 2 } });
  if (path === '/api/comparisons/games') return r.fulfill({ json: [{ id: 'hades', nome: 'Hades', edicao: 'Base', plataforma: 'PC', steam: { appId: 1145360 }, epic: { offerId: 'x', namespace: 'y' } }] });
  return r.fulfill({ status: 404, json: {} });
 });
});
test('orcamento, gratuidade e genero nao incluem preco ausente ou DLC', async ({ page }) => {
 await page.goto('/#/descobrir');
 await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'DLC excluido', exact: true })).toHaveCount(0);
 await page.getByLabel('Quanto quer gastar?').selectOption('budget');
 await expect(page.getByRole('heading', { name: 'Jogo caro', exact: true })).toHaveCount(0);
 await expect(page.getByRole('heading', { name: 'Jogo sem preco', exact: true })).toHaveCount(0);
 await page.getByLabel('Quanto quer gastar?').selectOption('free');
 await expect(page.getByRole('heading', { name: 'Jogo gratis', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toHaveCount(0);
 await page.getByLabel('Quanto quer gastar?').selectOption('all');
 await page.getByLabel(/Qual .* sua vibe/).selectOption('Aventura');
 await expect(page.getByRole('heading', { name: 'Jogo caro', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toHaveCount(0);
});
test('destaques reais e links de comparacao respeitam associacao exata', async ({ page }) => {
 await page.goto('/#/descobrir');
 await expect(page.getByRole('link', { name: /Comparar Steam e Epic/ })).toHaveAttribute('href', '#/comparacao/hades');
 await page.getByLabel('O que importa mais?').selectOption('price');
 await expect(page.locator('section[aria-labelledby="discover-title"] li h3').first()).toHaveText('Jogo gratis');
 await page.getByLabel('O que importa mais?').selectOption('discount');
 await expect(page.locator('section[aria-labelledby="discover-title"] li h3').first()).toHaveText('Hades');
 await page.getByRole('button', { name: 'Novidades', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Jogo sem preco', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toHaveCount(0);
 await expect(page.getByRole('link', { name: /Explorar ofertas deste jogo/ })).toHaveAttribute('href', '#/busca?q=Jogo%20sem%20preco');
});
test('paginacao so busca uma nova pagina por clique e remove repetidos', async ({ page }) => {
 let calls = 0;
 await page.route('**/api/steam/featured?page=2', r => { calls++; return r.fulfill({ json: { resultados: [items[0], { ...items[1], appId: 6, nome: 'Outro jogo' }], proximaPagina: 3 } }); });
 await page.goto('/#/descobrir'); await page.getByRole('button', { name: 'Descobrir mais jogos' }).click();
 await expect(page.getByRole('heading', { name: 'Outro jogo', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toHaveCount(1);
 expect(calls).toBe(1); await expect(page.getByRole('button', { name: 'Descobrir mais jogos' })).toBeEnabled();
});
test('home e descoberta cabem nas telas e atalhos ajustam orcamento', async ({ page }) => {
 for (const width of [390, 768, 1024, 1280, 1440]) {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 await page.getByRole('link', { name: /Jogatina sem estourar o bolso/ }).click();
 await expect(page.getByLabel('Quanto quer gastar?')).toHaveValue('budget');
 await expect(page.getByRole('heading', { name: 'Jogo caro', exact: true })).toHaveCount(0);
 await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.screenshot({ path: '.tmp-tools/discovery-mobile.png', fullPage: true });
 await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
 await page.getByRole('heading', { name: 'Hades', exact: true }).waitFor();
 await page.screenshot({ path: '.tmp-tools/discovery-home.png', fullPage: true });
});
test('falha permite tentar novamente e filtros vazios podem ser limpos', async ({ page }) => {
 let fail = true;
 await page.route('**/api/steam/featured', r => fail ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: { resultados: items } }));
 await page.goto('/#/descobrir'); await expect(page.getByRole('alert')).toBeVisible(); fail = false;
 await page.getByRole('button', { name: 'Tentar novamente' }).click(); await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toBeVisible();
 await page.getByLabel(/Qual .* sua vibe/).selectOption('Aventura'); await page.getByLabel('Quanto quer gastar?').selectOption('free');
 await expect(page.getByRole('heading', { name: 'Vamos ajustar a busca?' })).toBeVisible();
 await page.getByRole('button', { name: 'Limpar filtros' }).click(); await expect(page.getByRole('heading', { name: 'Hades', exact: true })).toBeVisible();
});
