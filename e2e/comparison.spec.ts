import { test, expect } from '@playwright/test';
const game = { id: 'hades', nome: 'Hades', edicao: 'Jogo base', plataforma: 'PC', steam: { appId: 1145360 }, epic: { offerId: '2ae6edb2223c4f8c97e9839b5b6497bb', namespace: 'min' } };
const steam = { loja: 'Steam', fonte: 'Steam', situacao: 'disponivel', precoCentavos: 9999, moeda: 'BRL', link: 'https://store.steampowered.com/app/1145360/', consultadoEm: '2026-10-21T12:00:00Z', registroPrecoEm: null, mensagem: null };
const epic = { ...steam, loja: 'Epic Games Store', fonte: 'EGData', precoCentavos: 7399, link: 'https://store.epicgames.com/pt-BR/p/hades' };
const comparison = { jogo: game, ofertas: [epic, steam], situacao: 'comparavel', menorPrecoCentavos: 7399, economiaCentavos: 2600, lojasMenorPreco: ['Epic Games Store'] };
test.beforeEach(async ({ page }) => {
 await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
 await page.route('**/api/comparisons/games', route => route.fulfill({ json: [game] }));
 await page.route('**/api/comparisons/hades', route => route.fulfill({ json: comparison }));
});
test('seleciona jogo conferido e compara em página própria no celular', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/#/comparacao');
 await page.getByLabel('Qual jogo você quer comparar?').fill('hades');
 await page.getByRole('link', { name: 'Comparar preços de Hades →' }).click();
 await expect(page).toHaveURL(/#\/comparacao\/hades$/);
 await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hades');
 const summary = page.getByRole('region', { name: 'Resultado da comparação' });
 await expect(summary).toContainText('Menor preço consultado: Epic Games Store');
 await expect(summary).toContainText('R$ 26,00');
 await expect(page.getByRole('link', { name: 'Ver na Epic ↗' })).toHaveAttribute('href', epic.link);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('busca sem associação explica cobertura sem adivinhar correspondência', async ({ page }) => {
 await page.goto('/#/comparacao');
 await page.getByLabel('Qual jogo você quer comparar?').fill('Outro jogo');
 await expect(page.getByText('A comparação deste jogo ainda não está disponível.', { exact: false })).toBeVisible();
 await expect(page.getByRole('link', { name: 'Comparar preços de Hades →' })).toHaveCount(0);
});
test('falha de uma loja mantém a outra e não mostra economia nem selo de menor preço', async ({ page }) => {
 await page.route('**/api/comparisons/hades', route => route.fulfill({ json: { ...comparison, ofertas: [steam, { ...epic, situacao: 'erro', precoCentavos: null, moeda: null, mensagem: 'Não foi possível consultar esta loja agora.' }], situacao: 'parcial', menorPrecoCentavos: null, economiaCentavos: null, lojasMenorPreco: [] } }));
 await page.goto('/#/comparacao/hades');
 await expect(page.getByRole('region', { name: 'Resultado da comparação' })).toContainText('Comparação parcial');
 await expect(page.getByRole('list', { name: 'Ofertas das lojas' })).toContainText('R$ 99,99');
 await expect(page.getByText('Melhor preço consultado', { exact: true })).toHaveCount(0);
 await expect(page.getByText('Economize', { exact: false })).toHaveCount(0);
});
test('empate e gratuidade aparecem corretamente', async ({ page }) => {
 await page.route('**/api/comparisons/hades', route => route.fulfill({ json: { ...comparison, ofertas: [{ ...steam, precoCentavos: 0 }, { ...epic, precoCentavos: 0 }], menorPrecoCentavos: 0, economiaCentavos: 0, lojasMenorPreco: ['Steam', 'Epic Games Store'] } }));
 await page.goto('/#/comparacao/hades');
 const summary = page.getByRole('region', { name: 'Resultado da comparação' });
 await expect(summary).toContainText('Mesmo preço nas duas lojas');
 await expect(summary).toContainText('Grátis nesta oferta');
});
test('erro de consulta oferece nova tentativa', async ({ page }) => {
 let available = false;
 await page.route('**/api/comparisons/hades', route => !available ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: comparison }));
 await page.goto('/#/comparacao/hades');
 await expect(page.getByRole('alert')).toBeVisible();
 available = true;
 await page.getByRole('button', { name: 'Tentar novamente' }).click();
 await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hades');
});
test('busca Steam leva à associação correta do Hades', async ({ page }) => {
 await page.route('**/api/steam/featured', route => route.fulfill({ json: { resultados: [{ appId: 1145360, nome: 'Hades', imagem: null, link: steam.link }] } }));
 await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [], proximaPagina: null } }));
 await page.route('**/api/steam/games/1145360', route => route.fulfill({ json: { appId: 1145360, nome: 'Hades', tipo: 'game', loja: 'Steam', regiao: 'BR', moeda: 'BRL', precoCentavos: 9999, situacaoPreco: 'informado', consultadoEm: steam.consultadoEm } }));
 await page.goto('/#/busca');
 await page.getByRole('button', { name: /Hades/ }).click();
 await page.getByRole('dialog').getByRole('link', { name: 'Comparar preços nas lojas →' }).click();
 await expect(page).toHaveURL(/#\/comparacao\/hades$/);
 await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hades');
});

test('seleção e comparação de outro jogo funcionam a partir do card Epic', async ({ page }) => {
 const celeste = { ...game, id: 'celeste', nome: 'Celeste', steam: { appId: 504230 }, epic: { offerId: '544c18ccadf8466691d8f2a335721b14', namespace: 'b671fbc7be424e888c9346a9a6d3d9db' } };
 const steamOffer = { ...steam, precoCentavos: 1499, link: 'https://store.steampowered.com/app/504230/' };
 const epicOffer = { ...epic, precoCentavos: 924, precoOriginalCentavos: 3699, descontoPercentual: 75, link: 'https://store.epicgames.com/pt-BR/p/celeste' };
 await page.route('**/api/comparisons/games', route => route.fulfill({ json: [game, celeste] }));
 await page.route('**/api/comparisons/celeste', route => route.fulfill({ json: { jogo: celeste, ofertas: [epicOffer, steamOffer], situacao: 'comparavel', menorPrecoCentavos: 924, economiaCentavos: 575, lojasMenorPreco: ['Epic Games Store'] } }));
 await page.route('**/api/steam/featured', route => route.fulfill({ json: { resultados: [] } }));
 await page.route('**/api/epic/games?*', route => route.fulfill({ json: { resultados: [{ ...epicOffer, ...celeste.epic, id: celeste.epic.offerId, namespace: celeste.epic.namespace, nome: 'Celeste', imagem: null }], proximaPagina: null } }));
 await page.goto('/#/busca');
 await page.getByRole('region', { name: 'Jogos da Epic' }).getByRole('link', { name: 'Comparar preços nas lojas →' }).click();
 await expect(page).toHaveURL(/#\/comparacao\/celeste$/);
 await expect(page.getByRole('region', { name: 'Resultado da comparação' })).toContainText('Economize R$ 5,75');
 await expect(page.getByRole('list', { name: 'Ofertas das lojas' })).toContainText('−75%');
 await page.getByRole('link', { name: 'Ver jogos disponíveis para comparar' }).click();
 await expect(page.getByRole('link', { name: 'Comparar preços de Celeste →' })).toBeVisible();
});
test('ambas sem preço não viram gratuidade ou economia', async ({ page }) => {
 await page.route('**/api/comparisons/hades', route => route.fulfill({ json: { ...comparison, ofertas: [steam, epic].map(offer => ({ ...offer, precoCentavos: null, moeda: null, situacao: 'sem_preco' })), situacao: 'sem_precos', menorPrecoCentavos: null, economiaCentavos: null, lojasMenorPreco: [] } }));
 await page.goto('/#/comparacao/hades');
 await expect(page.getByRole('region', { name: 'Resultado da comparação' })).toContainText('Preços indisponíveis nesta consulta');
 await expect(page.getByText('Grátis nesta oferta', { exact: true })).toHaveCount(0);
 await expect(page.getByText('Economize', { exact: false })).toHaveCount(0);
});
