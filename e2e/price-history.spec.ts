import { expect, test } from '@playwright/test';

const game = { id: 'hades', nome: 'Hades', edicao: 'Jogo base', plataforma: 'PC', steam: { appId: 1145360 }, epic: { offerId: 'hades-offer', namespace: 'min' } };
const steam = { loja: 'Steam', situacao: 'disponivel', precoCentavos: 5000, moeda: 'BRL', link: 'https://store.steampowered.com/app/1145360/' };
const epic = { ...steam, loja: 'Epic Games Store', link: 'https://store.epicgames.com/pt-BR/p/hades' };
const interval = { since: '2026-11-01T00:00:00.000Z', until: '2026-11-23T00:00:00.000Z' };
const historyApi = '**/api/comparisons/history/hades?*';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/comparisons/hades', route => route.fulfill({ json: {
    jogo: game, ofertas: [steam, epic], situacao: 'comparavel', menorPrecoCentavos: 5000, economiaCentavos: 0,
    lojasMenorPreco: ['Steam', 'Epic Games Store'],
  } }));
});

test('mostra legenda, datas e valores em reais sem ligar preços através de lacunas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(historyApi, route => route.fulfill({ json: {
    ...interval,
    series: [
      { store: 'steam', points: [
        { collectedAt: '2026-11-05T12:00:00.000Z', priceCents: 5000, state: 'available' },
        { collectedAt: '2026-11-06T12:00:00.000Z', priceCents: null, state: 'price_missing' },
        { collectedAt: '2026-11-07T12:00:00.000Z', priceCents: 0, state: 'available' },
      ] },
      { store: 'epic', points: [{ collectedAt: '2026-11-05T12:00:00.000Z', priceCents: 3000, state: 'available' }] },
    ],
  } }));
  await page.goto('/#/comparacao/hades');
  const history = page.getByRole('region', { name: 'Histórico de preços' });
  const chart = history.getByRole('img');
  await expect(chart).toBeVisible();
  await expect(chart.locator('circle')).toHaveCount(2);
  await expect(chart.locator('rect')).toHaveCount(1);
  await expect(chart.locator('polyline, path')).toHaveCount(0);
  await expect(history.locator('figcaption')).toContainText('Epic Games Store');
  await expect(history.locator('figcaption')).toContainText('horário de Brasília');
  await history.getByText('Ver observações por loja').click();
  await expect(history).toContainText('Preço não informado');
  await expect(history).toContainText(/R\$\s*0,00/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mostra carregando, falha, nova tentativa e período sem observações', async ({ page }) => {
  let release!: () => void;
  const suspended = new Promise<void>(resolve => { release = resolve; });
  await page.route(historyApi, async route => {
    await suspended;
    await route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/#/comparacao/hades');
  const history = page.getByRole('region', { name: 'Histórico de preços' });
  await expect(history.getByRole('status')).toHaveText('Carregando histórico de preços…');
  release();
  await expect(history.getByRole('alert')).toBeVisible();
  await page.route(historyApi, route => route.fulfill({ json: { ...interval, series: [] } }));
  await history.getByRole('button', { name: 'Recarregar histórico' }).click();
  await expect(history).toContainText('Ainda não há observações neste período.');
  const request = page.waitForRequest('**/api/comparisons/history/hades?days=7');
  await history.getByLabel('Período').selectOption('7');
  await request;
  await expect(history).toContainText('Ainda não há observações neste período.');
});
