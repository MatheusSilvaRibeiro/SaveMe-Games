import { test, expect } from '@playwright/test';
test('salva preferencias, persiste apos recarga e cabe no celular', async ({ page }) => {
 let enabled = true;
 await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health') return route.fulfill({ json: { status: 'ok', service: 'saveme-api' } });
  if (path === '/api/auth/me') return route.fulfill({ json: { user: { id: 'a', name: 'Teste', email: 'a@example.com' } } });
  if (path === '/api/alerts/unread') return route.fulfill({ json: { count: 0 } });
  if (path === '/api/preferences') {
   if (route.request().method() === 'PATCH') enabled = route.request().postDataJSON().priceAlertsEnabled;
   return route.fulfill({ json: { priceAlertsEnabled: enabled } });
  }
  return route.fulfill({ status: 404, json: {} });
 });
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/#/preferencias');
 const checkbox = page.getByRole('checkbox');
 await expect(checkbox).toBeChecked(); await checkbox.uncheck();
 await page.getByRole('button', { name: /Salvar prefer/ }).click();
 await expect(page.getByRole('status')).toContainText(/salvas/);
 await page.reload(); await expect(checkbox).not.toBeChecked();
 for (const width of [390, 1024, 1440]) {
  await page.setViewportSize({ width, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
});
test('visitante nao acessa configuracoes da conta', async ({ page }) => {
 await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', service: 'saveme-api' } }));
 await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
 await page.goto('/#/preferencias');
 await expect(page.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
 await expect(page.getByRole('checkbox')).toHaveCount(0);
});
