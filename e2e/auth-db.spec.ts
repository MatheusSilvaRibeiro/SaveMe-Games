import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';

test('cadastro e login reais persistem no PostgreSQL @postgres', async ({ page }) => {
  test.setTimeout(60000);
  test.skip(process.env.AUTH_DB_TEST !== '1', 'Requer PostgreSQL local e migrações aplicadas.');
  process.loadEnvFile('backend/.env');
  const require = createRequire(new URL('../backend/package.json', import.meta.url));
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const email = `browser-test-${crypto.randomUUID()}@example.com`;
  await page.route('**/api/steam/featured*', route => route.fulfill({ json: { resultados: [] } }));
  try {
    await page.goto('/#/cadastro');
    await page.getByLabel('Nome', { exact: true }).fill('Jogador de teste');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
    await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-de-teste');
    await page.getByRole('button', { name: 'Criar conta', exact: false }).click();
    await expect(page).toHaveURL(/#\/busca$/);
    await expect(page.getByText('Olá, Jogador de teste', { exact: true }).first()).toBeVisible();
    const saved = await db.user.findUniqueOrThrow({ where: { email } });
    expect(saved.passwordHash).not.toBe('senha-de-teste');
    await page.reload();
    await expect(page.getByText('Olá, Jogador de teste', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).first().click();
    await expect(page).toHaveURL(/#\/login$/);
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar', exact: false }).click();
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar', exact: false }).click();
    await expect(page).toHaveURL(/#\/busca$/);
    await expect(page.getByText('Olá, Jogador de teste', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).first().click();
    expect(await db.session.count({ where: { userId: saved.id } })).toBe(0);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
