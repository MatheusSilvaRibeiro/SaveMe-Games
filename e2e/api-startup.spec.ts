import { test, expect } from '@playwright/test';

test('aguarda inicio lento antes do login sem repetir POST', async ({ page }) => {
  let health = 0, login = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') {
      health++;
      await new Promise(resolve => setTimeout(resolve, 17000));
      return route.fulfill({ json: { status: 'ok', service: 'saveme-api' } });
    }
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
    if (path === '/api/auth/login') {
      login++;
      return route.fulfill({ json: { user: { id: 'test-user', name: 'Teste', email: 'test@example.com' } } });
    }
    if (path === '/api/favorites' || path === '/api/comparisons/games') return route.fulfill({ json: [] });
    if (path === '/api/alerts/unread') return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: { resultados: [], proximaPagina: null } });
  });
  await page.goto('/#/login');
  await page.getByLabel('E-mail', { exact: true }).fill('test@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Senha-teste-123');
  await page.getByRole('button', { name: /^Entrar/ }).click();
  await expect(page.getByText(/Iniciando o servidor/)).toBeVisible();
  expect(login).toBe(0);
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible({ timeout: 25000 });
  expect(health).toBe(1);
  expect(login).toBe(1);
  await expect(page.getByText(/Iniciando o servidor/)).toHaveCount(0);
});

test('servidor indisponivel informa falha sem enviar credenciais', async ({ page }) => {
  let login = 0;
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/auth/login') login++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/#/login');
  await page.getByLabel('E-mail', { exact: true }).fill('test@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Senha-teste-123');
  await page.getByRole('button', { name: /^Entrar/ }).click();
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Entrar/ })).toBeEnabled();
  expect(login).toBe(0);
});
