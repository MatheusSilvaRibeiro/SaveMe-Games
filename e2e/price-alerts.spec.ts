import { expect, test } from '@playwright/test';

const first = {
  id: '10', gameId: 'hades', gameName: 'Hades', store: 'steam', storeUrl: 'https://store.steampowered.com/app/1145360/',
  region: 'BR', currency: 'BRL', previousPriceCents: 5000, newPriceCents: 0, observedAt: '2026-11-22T12:00:00Z', readAt: null,
};

test('lista avisos, navega páginas e atualiza não lidos após marcar leitura', async ({ page }) => {
  let read = false;
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'account-a', name: 'Conta A' } } }));
  await page.route('**/api/alerts/unread', route => route.fulfill({ json: { count: read ? 0 : 1 } }));
  await page.route('**/api/alerts', route => route.fulfill({ json: { items: [first], nextCursor: '10' } }));
  await page.route('**/api/alerts?before=10', route => route.fulfill({
    json: { items: [{ ...first, id: '9', gameName: 'Celeste', gameId: 'celeste', readAt: '2026-11-22T13:00:00Z' }], nextCursor: null },
  }));
  await page.route('**/api/alerts/10/read', async route => {
    expect(route.request().method()).toBe('PATCH');
    read = true;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/#/avisos');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link', { name: /Avisos 1 não lidos/ })).toBeVisible();
  const list = page.getByRole('list', { name: 'Avisos de queda de preço' });
  await expect(list).toContainText(/R\$\s*50,00.*R\$\s*0,00/);
  await expect(list.getByRole('link', { name: 'Ver comparação' })).toHaveAttribute('href', '#/comparacao/hades');
  await expect(list.getByRole('link', { name: 'Ver na loja' })).toHaveAttribute('href', first.storeUrl);
  await page.getByRole('button', { name: 'Carregar mais avisos' }).click();
  await expect(list.getByRole('heading', { name: 'Celeste' })).toBeVisible();
  await list.getByRole('button', { name: 'Marcar como lido' }).click();
  await expect(list.getByText('Não lido', { exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Avisos', exact: true })).toBeVisible();
});

test('trata visitante e lista vazia sem avisos', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/#/avisos');
  await expect(page.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'account-b', name: 'Conta B' } } }));
  await page.route('**/api/alerts', route => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route('**/api/alerts/unread', route => route.fulfill({ json: { count: 0 } }));
  await page.reload();
  await expect(page.getByText('Você ainda não tem avisos de queda de preço.')).toBeVisible();
});
