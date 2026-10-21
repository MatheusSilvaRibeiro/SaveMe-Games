import { test, expect } from '@playwright/test';
const steam = { appId: 504230, nome: 'Celeste', imagem: null, link: 'https://store.steampowered.com/app/504230/', tipo: 'game', loja: 'Steam', regiao: 'BR', moeda: 'BRL', precoCentavos: 9999, situacaoPreco: 'informado', consultadoEm: '2026-10-21T20:00:00Z' };
const epic = { id: 'celeste', namespace: 'celeste', nome: 'Celeste', imagem: null, precoCentavos: 7399, moeda: 'BRL', fonte: 'EGData', link: 'https://store.epicgames.com/pt-BR/p/celeste', consultadoEm: steam.consultadoEm, registroPrecoEm: '2026-10-20T20:00:00Z', disponibilidade: 'disponivel' };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/steam/featured', route => route.fulfill({ json: { resultados: [steam] } }));
});
async function setup(page: import('@playwright/test').Page, overrides = {}) {
  await page.route('**/api/steam/games?*', route => route.fulfill({ json: { resultados: [steam] } }));
  await page.route('**/api/steam/games/504230', route => route.fulfill({ json: steam }));
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [epic], proximaPagina: null } }));
  await page.route('**/api/epic/games/celeste', route => route.fulfill({ json: { ...epic, ...overrides } }));
  await page.goto('/#/comparacao');
  await page.getByRole('button', { name: 'Celeste', exact: true }).click();
  await page.getByRole('button', { name: /Comparar este título/ }).click();
}
test('destaca menor preço e economia e cabe no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.getByRole('heading', { name: /Economize R\$\s*26,00/ })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Oferta Epic', exact: true })).toContainText('MENOR PREÇO');
  await expect(page.getByRole('link', { name: /Ver oferta na Epic/ })).toHaveAttribute('href', epic.link);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.tmp-tools/comparacao-mobile.png', fullPage: true });
});
test('empate não promete economia', async ({ page }) => {
  await setup(page, { precoCentavos: steam.precoCentavos });
  await expect(page.getByText('Empate no preço. A escolha é sua.')).toBeVisible();
  await expect(page.getByText('MESMO PREÇO', { exact: true })).toHaveCount(2);
});
test('preço ausente não se torna gratuito ou vencedor', async ({ page }) => {
  await setup(page, { precoCentavos: null, disponibilidade: 'sem_preco' });
  await expect(page.getByText('Comparação incompleta', { exact: true })).toBeVisible();
  await expect(page.getByText('MENOR PREÇO', { exact: true })).toHaveCount(0);
});
test('falha de uma loja mantém outra oferta', async ({ page }) => {
  await page.route('**/api/epic/games/celeste', route => route.fulfill({ status: 503, json: {} }));
  // Register failure after setup routes, before selecting.
  await setup(page);
  await page.route('**/api/epic/games/celeste', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: /Atualizar consulta/ }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível atualizar Epic');
  await expect(page.getByRole('article', { name: 'Oferta Steam', exact: true })).toContainText('99,99');
});
test('edições diferentes permanecem separadas', async ({ page }) => {
  await page.route('**/api/steam/games?*', route => route.fulfill({ json: { resultados: [steam] } }));
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [{ ...epic, nome: 'Celeste Deluxe' }], proximaPagina: null } }));
  await page.goto('/#/comparacao');
  await page.getByRole('button', { name: 'Celeste', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Jogos para comparar' }).getByRole('button')).toHaveCount(2);
});
test('oferta gratuita mantém o zero como preço válido', async ({ page }) => {
  await setup(page, { precoCentavos: 0 });
  await expect(page.getByRole('article', { name: 'Oferta Epic', exact: true })).toContainText('Grátis');
  await expect(page.getByRole('heading', { name: /Economize R\$\s*99,99/ })).toBeVisible();
});
test('títulos duplicados suspendem indicação de vencedor', async ({ page }) => {
  await page.route('**/api/steam/games?*', route => route.fulfill({ json: { resultados: [steam] } }));
  await page.route('**/api/steam/games/504230', route => route.fulfill({ json: steam }));
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [epic, { ...epic, id: 'other' }], proximaPagina: null } }));
  await page.route('**/api/epic/games/celeste', route => route.fulfill({ json: epic }));
  await page.goto('/#/comparacao');
  await page.getByRole('button', { name: 'Celeste', exact: true }).click();
  await page.getByRole('button', { name: /Comparar este título/ }).click();
  await expect(page.getByRole('alert')).toContainText('múltiplas ofertas');
  await expect(page.getByText('MENOR PREÇO', { exact: true })).toHaveCount(0);
});
test('carrega sugestões ao abrir e pesquisa ao digitar sem enviar formulário', async ({ page }) => {
  const searches: string[] = [];
  await page.route('**/api/steam/games?*', route => {
    searches.push(new URL(route.request().url()).searchParams.get('q') || '');
    return route.fulfill({ json: { resultados: [{ ...steam, nome: 'Hades' }] } });
  });
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [], proximaPagina: null } }));
  await page.goto('/#/comparacao');
  const games = page.getByRole('region', { name: 'Jogos para comparar' });
  await expect(games).toContainText('Celeste');
  const input = page.getByLabel('Qual jogo você quer comparar?');
  await input.fill('H');
  await page.waitForTimeout(550);
  expect(searches).toEqual([]);
  await input.fill('Ha');
  await input.fill('Hades');
  await expect(games).toContainText('Hades');
  expect(searches).toEqual(['Hades']);
  await input.fill('');
  await expect(games).toContainText('Celeste');
});
