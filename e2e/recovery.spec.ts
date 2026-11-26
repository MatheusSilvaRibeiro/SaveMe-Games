import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
 await page.route('**/api/health', r => r.fulfill({ json: { status: 'ok', service: 'saveme-api' } }));
 await page.route('**/api/auth/me', r => r.fulfill({ status: 401, json: {} }));
});
test('login abre recuperacao e confirma solicitacao sem revelar conta', async ({ page }) => {
 await page.route('**/api/auth/forgot-password', r => {
  expect(r.request().postDataJSON()).toEqual({ email: 'test@example.invalid' });
  return r.fulfill({ json: { message: 'Se houver uma conta com este e-mail, enviaremos um link.' } });
 });
 await page.goto('/#/login'); await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
 await page.getByLabel('E-mail', { exact: true }).fill('test@example.invalid'); await page.getByRole('button', { name: 'Enviar link' }).click();
 await expect(page.getByRole('status')).toContainText('Se houver uma conta');
});
test('nova senha exige confirmacao e remove token do endereco ao concluir', async ({ page }) => {
 const token = 'a'.repeat(64); let calls = 0;
 await page.route('**/api/auth/reset-password', r => {
  calls++; expect(r.request().postDataJSON()).toEqual({ token, password: 'new-password' });
  return r.fulfill({ json: { message: 'Senha atualizada. Entre novamente.' } });
 });
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto(`/#/redefinir-senha?token=${token}`);
 await page.getByLabel('Nova senha', { exact: true }).fill('new-password'); await page.getByLabel('Confirmar senha').fill('wrong-password');
 await page.getByRole('button', { name: 'Salvar nova senha' }).click(); await expect(page.getByRole('alert')).toContainText(/coincidem/); expect(calls).toBe(0);
 await page.getByLabel('Confirmar senha').fill('new-password'); await page.getByRole('button', { name: 'Salvar nova senha' }).click();
 await expect(page.getByRole('status')).toContainText('Senha atualizada'); expect(page.url()).not.toContain('token='); expect(calls).toBe(1);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('link invalido e indisponibilidade de envio ficam explicitos', async ({ page }) => {
 await page.goto('/#/redefinir-senha?token=bad'); await expect(page.getByRole('alert')).toContainText(/Link inv/); await expect(page.getByRole('button', { name: 'Salvar nova senha' })).toHaveCount(0);
 await page.route('**/api/auth/forgot-password', r => r.fulfill({ status: 503, json: { message: 'Recuperacao de senha indisponivel.' } }));
 await page.goto('/#/recuperar-senha'); await page.getByLabel('E-mail', { exact: true }).fill('test@example.invalid'); await page.getByRole('button', { name: 'Enviar link' }).click();
 await expect(page.getByRole('alert')).toContainText('indisponivel');
});
