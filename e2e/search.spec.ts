import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [], proximaPagina: null } }));
  await page.route('**/api/steam/featured', route => route.fulfill({ json: { termo: '', resultados: [] } }));
});

const item = { appId: 620, nome: 'Portal 2', imagem: null, link: 'https://store.steampowered.com/app/620/' };
const details = { ...item, tipo: 'game', loja: 'Steam', regiao: 'BR', moeda: 'BRL', precoCentavos: 3399, situacaoPreco: 'informado', consultadoEm: '2026-10-20T20:00:00Z' };

test('pesquisa só ao enviar e abre a oferta correta; Escape devolve o foco', async ({ page }) => {
  let searches = 0;
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => {
    if (new URL(route.request().url()).pathname.endsWith('/620')) return route.fulfill({ json: details });
    searches++;
    return route.fulfill({ json: { termo: 'Portal 2', resultados: [item] } });
  });
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
  expect(searches).toBe(0);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const result = page.getByRole('button', { name: /Portal 2/ });
  await result.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('R$ 33,99');
  await expect(page.getByRole('link', { name: /Ver na Steam/ })).toHaveAttribute('href', item.link);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(result).toBeFocused();
});

test('busca vazia e falha do serviço têm estados diferentes', async ({ page }) => {
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    return q === 'vazio' ? route.fulfill({ json: { termo: q, resultados: [] } }) : route.fulfill({ status: 503, json: { code: 'NETWORK_ERROR' } });
  });
  await page.goto('/#/busca');
  const input = page.getByLabel('Qual jogo você está procurando?');
  await input.fill('vazio'); await input.press('Enter');
  await expect(page.getByRole('status')).toContainText('Nenhum resultado');
  await input.fill('falha'); await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar a Steam');
  await expect(page.getByText('Nenhum resultado', { exact: false })).toHaveCount(0);
});

test('preço ausente não aparece como gratuito e falha de detalhes permite repetir', async ({ page }) => {
  let attempts = 0;
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => {
    if (!new URL(route.request().url()).pathname.endsWith('/620')) return route.fulfill({ json: { resultados: [item] } });
    if (++attempts === 1) return route.fulfill({ status: 504, json: { code: 'TIMEOUT' } });
    return route.fulfill({ json: { ...details, precoCentavos: null, moeda: null, situacaoPreco: 'indisponivel' } });
  });
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Portal 2/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('dialog')).toContainText('Preço indisponível');
  await expect(page.getByRole('dialog')).not.toContainText('Gratuito');
});

test('modal e busca cabem no celular e jogo gratuito é identificado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => route.fulfill({ json:
    new URL(route.request().url()).pathname.endsWith('/620')
      ? { ...details, precoCentavos: 0, situacaoPreco: 'gratuito' }
      : { resultados: [item] },
  }));
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Portal 2/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Gratuito');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Voltar à busca' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('termo muito curto não consulta a API', async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => { calls++; await route.fulfill({ json: { resultados: [] } }); });
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('a');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Digite entre 2 e 100 caracteres');
  expect(calls).toBe(0);
});

test('fluxo real pela API e Steam @live', async ({ page }) => {
  test.skip(process.env.STEAM_LIVE_TEST !== '1', 'Consulta externa opcional; não faz parte dos testes determinísticos.');
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('region', { name: 'Resultados da busca' }).getByRole('button')
    .filter({ has: page.getByText('Portal 2', { exact: true }) }).click();
  await expect(page.getByRole('link', { name: /Ver na Steam/ })).toHaveAttribute('href', item.link, { timeout: 20000 });
  await expect(page.getByRole('dialog')).toContainText('Consultado em');
});


for (const scenario of [
  { type: 'game', label: 'Jogo', note: null },
  { type: 'dlc', label: 'DLC / conteúdo adicional', note: 'Confira na Steam se este conteúdo exige o jogo base.' },
  { type: 'demo', label: 'Demonstração', note: 'não a versão completa do jogo' },
  { type: 'music', label: 'Trilha sonora', note: 'não o jogo' },
  { type: 'unknown-future-type', label: 'Tipo não identificado', note: 'Confira a descrição na Steam' },
  { type: null, label: 'Tipo não identificado', note: 'Confira a descrição na Steam' },
]) {
  test(`identifica conteúdo sem presumir jogo: ${scenario.type ?? 'ausente'}`, async ({ page }) => {
    await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => route.fulfill({ json:
      new URL(route.request().url()).pathname.endsWith('/620')
        ? { ...details, tipo: scenario.type }
        : { resultados: [item] },
    }));
    await page.goto('/#/busca');
    await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('button', { name: /Portal 2/ }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(`Tipo de conteúdo: ${scenario.label}`, { exact: true })).toBeVisible();
    if (scenario.note) await expect(modal).toContainText(scenario.note);
    await expect(modal.getByRole('link', { name: /Ver na Steam/ })).toHaveAttribute('href', item.link);
  });
}


test('cards e popup mostram preço, especificações e nota com fonte', async ({ page }) => {
  await page.route(/\/api\/steam\/games(?:\?|\/)/, async route => route.fulfill({ json:
    new URL(route.request().url()).pathname.endsWith('/620')
      ? { ...details, metacritic: 95, sistemas: ['Windows', 'Linux'], generos: ['Ação', 'Aventura'], desenvolvedoras: ['Valve'], lancamento: '18 abr. 2011' }
      : { resultados: [{ ...item, precoCentavos: 3399, metacritic: 95, sistemas: ['Windows', 'Linux'] }] },
  }));
  await page.goto('/#/busca');
  await page.getByLabel('Qual jogo você está procurando?').fill('Portal 2');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const card = page.getByRole('button', { name: /Portal 2.*Ver oferta na Steam/ });
  await expect(card).toContainText('Metacritic 95/100');
  await expect(card).toContainText('Windows · Linux');
  await expect(card).toContainText('R$ 33,99');
  await card.click();
  await expect(page.getByRole('dialog')).toContainText('Valve');
  await expect(page.getByRole('dialog')).toContainText('18 abr. 2011');
  await expect(page.getByRole('dialog')).toContainText('Ação, Aventura');
  await expect(page.getByRole('dialog')).toContainText('nota da crítica');
});
