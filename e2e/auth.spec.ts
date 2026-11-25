import { test, expect } from '@playwright/test';

test('cadastro valida confirmação e mantém o padrão da interface', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Entre na sua conta.' } }));
  await page.goto('/#/cadastro');
  await page.getByLabel('Nome', { exact: true }).fill('Jogador');
  await page.getByLabel('E-mail', { exact: true }).fill('jogador@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('outra-senha');
  await page.getByRole('button', { name: 'Criar conta', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText('As senhas não coincidem');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-de-teste');
  await page.route('**/api/auth/register', async route => {
    expect(route.request().postDataJSON()).toEqual({ name: 'Jogador', email: 'jogador@example.com', password: 'senha-de-teste' });
    await route.fulfill({ status: 409, json: { message: 'Este e-mail já está cadastrado.' } });
  });
  await page.getByRole('button', { name: 'Criar conta', exact: false }).click();
  await expect(page.getByRole('alert')).toHaveText('Este e-mail já está cadastrado.');
});

test('login mostra usuário e sair atualiza o cabeçalho', async ({ page }) => {
  const user = { id: 'test-user', name: 'Jogador', email: 'jogador@example.com' };
  let loggedIn = false;
  await page.route('**/api/auth/me', route => route.fulfill({ status: loggedIn ? 200 : 401, json: loggedIn ? { user } : { message: 'Entre na sua conta.' } }));
  await page.route('**/api/auth/login', async route => {
    loggedIn = true;
    await route.fulfill({ json: { user } });
  });
  await page.route('**/api/auth/logout', async route => {
    loggedIn = false;
    await route.fulfill({ json: { message: 'Você saiu.' } });
  });
  await page.route('**/api/steam/featured*', route => route.fulfill({ json: { resultados: [] } }));
  await page.goto('/#/login');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar', exact: false }).click();
  await expect(page).toHaveURL(/#\/busca$/);
  await expect(page.getByText('Olá, Jogador', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Olá, Jogador', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole('link', { name: 'Entrar', exact: true }).first()).toBeVisible();
});
