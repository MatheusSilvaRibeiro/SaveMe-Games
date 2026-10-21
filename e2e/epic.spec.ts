import { test, expect } from '@playwright/test';
const game = { appId: 504230, nome: 'Celeste', imagem: null, link: 'https://store.steampowered.com/app/504230/', tipo: 'game', loja: 'Steam', regiao: 'BR', moeda: 'BRL', precoCentavos: 9999, situacaoPreco: 'informado', consultadoEm: '2026-10-20T20:00:00Z' };
const offer = { id: 'celeste-offer', namespace: 'celeste', nome: 'Celeste', imagem: null, precoCentavos: 7399, moeda: 'BRL', fonte: 'EGData', link: 'https://store.epicgames.com/pt-BR/p/celeste', consultadoEm: game.consultadoEm, registroPrecoEm: '2026-01-08T16:09:34Z', generos: ['Ação'] };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/steam/featured', route => route.fulfill({ json: { resultados: [game] } }));
  await page.route('**/api/steam/games?*', route => route.fulfill({ json: { resultados: [game] } }));
  await page.route('**/api/steam/games/504230', route => route.fulfill({ json: game }));
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [offer], proximaPagina: null } }));
  await page.route('**/api/epic/games/celeste-offer', route => route.fulfill({ json: offer }));
});
test('busca mostra ambas as lojas e direciona a oferta Epic sem entrar na comparação', async ({ page }) => {
  await page.goto('/#/busca');
  const epic = page.getByRole('region', { name: 'Jogos da Epic' });
  await expect(epic).toContainText('Celeste');
  await expect(epic.getByRole('link', { name: 'Ver oferta na Epic ↗' })).toHaveAttribute('href', offer.link);
  await expect(epic.getByRole('link')).toHaveCount(1);
  await page.getByLabel('Qual jogo você está procurando?').fill('Celeste');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(epic).toContainText('Resultados na Epic');
  await page.getByRole('button', { name: /Celeste/ }).click();
  await expect(page.getByRole('dialog')).not.toContainText('EGData');
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Comparar preços' })).toHaveCount(0);
});
test('botões navegam entre lojas sem esconder resultados; filtros funcionam no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/busca');
  const epic = page.getByRole('region', { name: 'Jogos da Epic' });
  await expect(epic.getByRole('heading', { name: 'Celeste' })).toBeVisible();
  await expect(page.getByLabel('Loja', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver jogos da Epic ↓', exact: true }).click();
  expect(await page.locator('#epic-catalog').evaluate(element => Math.abs(element.getBoundingClientRect().top - 32)) < 80).toBe(true);
  await expect(page.getByRole('region', { name: 'Resultados da busca' })).toBeVisible();
  await page.getByLabel('Gênero', { exact: true }).selectOption('Ação');
  await page.getByLabel('Preço', { exact: true }).selectOption('paid');
  await expect(epic.getByRole('heading', { name: 'Celeste' })).toBeVisible();
  await page.getByLabel('Preço', { exact: true }).selectOption('free');
  await expect(epic).toContainText('Nenhum título da Epic corresponde aos filtros');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByRole('region', { name: 'Resultados da busca' })).toBeVisible();
  await expect(epic.getByRole('heading', { name: 'Celeste' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('falha da Epic na busca preserva os resultados Steam', async ({ page }) => {
  await page.route('**/api/epic/games?*', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/#/busca');
  await expect(page.getByRole('region', { name: 'Jogos da Epic' })).toContainText('Não foi possível carregar');
  await expect(page.getByRole('button', { name: /Celeste/ })).toBeVisible();
});

test('catálogo Epic carrega mais sem duplicar ofertas e informa busca vazia', async ({ page }) => {
  await page.route('**/api/epic/games?*', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: params.get('q') ? { resultados: [], proximaPagina: null } : {
      resultados: params.get('page') === '2' ? [offer, { ...offer, id: 'other-offer', nome: 'Outro jogo Epic' }] : [offer],
      proximaPagina: params.get('page') === '2' ? null : 2,
    } });
  });
  await page.goto('/#/busca');
  const section = page.getByRole('region', { name: 'Jogos da Epic' });
  await section.getByRole('button', { name: 'Carregar mais jogos da Epic' }).click();
  await expect(section.getByRole('heading', { name: 'Outro jogo Epic' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Celeste', exact: true })).toHaveCount(1);
  await page.getByLabel('Qual jogo você está procurando?').fill('inexistente');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(section).toContainText('Nenhum jogo encontrado na Epic');
});

test('jogo futuro não mostra valor como oferta de compra', async ({ page }) => {
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [{ ...offer, emBreve: true, precoCentavos: null }], proximaPagina: null } }));
  await page.goto('/#/busca');
  const epic = page.getByRole('region', { name: 'Jogos da Epic' });
  await expect(epic).toContainText('Em breve');
  await expect(epic.getByRole('link', { name: 'Ver página na Epic ↗' })).toHaveAttribute('href', offer.link);
  await expect(epic.getByRole('link', { name: 'Ver oferta na Epic ↗' })).toHaveCount(0);
});

test('oferta sem página canônica oferece pesquisa explícita na loja', async ({ page }) => {
  await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [{ ...offer, link: null, precoCentavos: null }], proximaPagina: null } }));
  await page.goto('/#/busca');
  const epic = page.getByRole('region', { name: 'Jogos da Epic' });
  await expect(epic).toContainText('Preço não informado para o Brasil');
  await expect(epic.getByRole('link', { name: 'Pesquisar na Epic ↗' })).toHaveAttribute('href', 'https://store.epicgames.com/pt-BR/browse?q=Celeste&sortBy=relevancy&sortDir=DESC&count=40');
  await expect(epic).toContainText('Página exata não informada');
});
