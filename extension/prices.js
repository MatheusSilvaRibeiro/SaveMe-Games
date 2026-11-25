const api = 'http://127.0.0.1:5173/api';

async function request(path) {
  const response = await fetch(api + path, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Falha ao consultar a API do SaveMe.');
  return response.json();
}

async function lookup(title) {
  const search = await request('/steam/games?' + new URLSearchParams({ q: title }));
  const [offer] = search.resultados;
  if (!offer) return null;
  const appId = encodeURIComponent(offer.appId);
  const comparison = await request('/comparisons/steam/' + appId).catch(() => null);
  if (comparison) {
    return {
      name: comparison.jogo.nome,
      image: comparison.jogo.imagem ?? offer.imagem,
      offers: comparison.ofertas.map(offer => ({ store: offer.loja, price: offer.precoCentavos })),
      cheapest: comparison.lojasMenorPreco,
    };
  }

  const details = offer.precoCentavos == null
    ? await request('/steam/games/' + appId).catch(() => offer)
    : offer;
  return {
    name: details.nome,
    image: details.imagem,
    offers: [{ store: 'Steam', price: details.precoCentavos }],
    cheapest: [],
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'saveme:prices' || typeof message.title !== 'string') return;
  const title = message.title.trim();
  if (title.length < 2 || title.length > 100) return;
  lookup(title).then(result => sendResponse({ result })).catch(() => sendResponse({ error: true }));
  return true;
});
