importScripts('config.js');
const { api, site } = SaveMeConfig;
let ready;
async function request(path) {
  if (!ready) ready = fetch(api + '/health', { signal: AbortSignal.timeout(90000), cache: 'no-store' })
    .then(async response => { if (!response.ok || (await response.json()).service !== 'saveme-api') throw new Error('UNAVAILABLE'); })
    .catch(error => { ready = undefined; throw error; });
  await ready;
  const response = await fetch(api + path, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(response.status === 404 ? 'NOT_FOUND' : 'UNAVAILABLE');
  return response.json();
}
function comparisonResult(comparison) {
  return {
    name: comparison.jogo.nome, image: comparison.jogo.imagem,
    link: site + '/#/comparacao/' + encodeURIComponent(comparison.jogo.id),
    offers: comparison.ofertas.map(offer => ({ store: offer.loja, price: offer.precoCentavos })),
    cheapest: comparison.lojasMenorPreco,
  };
}
async function lookupAppId(appId) {
  try { return comparisonResult(await request('/comparisons/steam/' + appId)); }
  catch (error) { if (error.message !== 'NOT_FOUND') throw error; }
  const details = await request('/steam/games/' + appId);
  if (String(details.appId) !== String(appId) || details.tipo !== 'game') throw new Error('NO_EXACT_MATCH');
  return {
    name: details.nome, image: details.imagem,
    link: site + '/#/busca?' + new URLSearchParams({ q: details.nome }),
    offers: [{ store: 'Steam', price: details.precoCentavos }], cheapest: [],
  };
}
async function lookup(title) {
  const key = value => value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
  const games = await request('/comparisons/games');
  const matches = games.filter(game => key(game.nome) === key(title));
  if (matches.length === 1) return comparisonResult(await request('/comparisons/' + encodeURIComponent(matches[0].id)));
  if (matches.length > 1) throw new Error('NO_EXACT_MATCH');
  const search = await request('/steam/games?' + new URLSearchParams({ q: title }));
  const exact = search.resultados.filter(offer => key(offer.nome) === key(title));
  if (exact.length !== 1) throw new Error('NO_EXACT_MATCH');
  return lookupAppId(String(exact[0].appId));
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'saveme:prices') return;
  let url;
  try { url = new URL(sender.url); } catch { return; }
  if (url.protocol !== 'https:') return;
  let operation;
  if (url.hostname === 'store.steampowered.com') {
    const appId = /^\/app\/([1-9][0-9]*)/.exec(url.pathname)?.[1];
    if (!appId || message.appId !== appId || !Number.isSafeInteger(Number(appId))) return;
    operation = lookupAppId(appId);
  } else if (['www.google.com', 'www.google.com.br'].includes(url.hostname) && url.pathname === '/search') {
    if (typeof message.title !== 'string' || message.title.trim().length < 2 || message.title.trim().length > 100) return;
    operation = lookup(message.title.trim());
  } else return;
  operation.then(result => sendResponse({ result })).catch(error => sendResponse({ error: error.message === 'NO_EXACT_MATCH' ? 'NO_EXACT_MATCH' : 'UNAVAILABLE' }));
  return true;
});
