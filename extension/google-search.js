(() => {
  const saveMeOrigin = 'http://127.0.0.1:5173';
  const { pathname, search } = window.location;
  if (pathname !== '/search') return;

  const query = new URLSearchParams(search).get('q')?.trim();
  if (!query) return;

  const title = query
    .replace(/^(?:preço d[eo] |onde comprar )/iu, '')
    .replace(/\s+(?:preço|onde comprar)\??$/iu, '')
    .trim();
  if (title.length < 2 || title.length > 100) return;

  const panel = document.createElement('aside');
  panel.className = 'saveme-games-panel';
  panel.setAttribute('aria-label', 'Ofertas do SaveMe Games');

  const heading = document.createElement('strong');
  heading.textContent = title;
  const image = document.createElement('img');
  image.alt = '';
  image.hidden = true;
  const prices = document.createElement('div');
  prices.className = 'saveme-games-prices';
  prices.setAttribute('role', 'status');
  prices.textContent = 'Consultando preços…';

  const params = new URLSearchParams({ q: title });
  const link = document.createElement('a');
  link.className = 'saveme-games-compare-link';
  link.href = new URL(`/#/comparacao?${params}`, saveMeOrigin).href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ver no SaveMe';
  panel.append(heading, image, prices, link);
  document.body.append(panel);

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  chrome.runtime.sendMessage({ type: 'saveme:prices', title }).then(response => {
    if (response?.error) throw new Error();
    const result = response?.result;
    if (!result) {
      prices.textContent = 'Nenhum jogo encontrado na Steam para esta busca.';
      return;
    }

    heading.textContent = result.name;
    params.set('q', result.name);
    link.href = new URL(`/#/comparacao?${params}`, saveMeOrigin).href;
    if (typeof result.image === 'string' && result.image.startsWith('https://')) {
      image.src = result.image;
      image.hidden = false;
    }

    const summary = document.createElement('p');
    if (result.cheapest.length > 1) summary.textContent = 'Mesmo preço nas duas lojas';
    else if (result.cheapest.length === 1) summary.textContent = `Mais barato na ${result.cheapest[0]}`;
    else if (result.offers.some(offer => Number.isSafeInteger(offer.price))) summary.textContent = 'Preço disponível em uma loja';

    const offers = document.createElement('ul');
    for (const offer of result.offers) {
      const item = document.createElement('li');
      const store = document.createElement('span');
      const price = document.createElement('strong');
      store.textContent = offer.store;
      price.textContent = Number.isSafeInteger(offer.price) && offer.price >= 0
        ? money.format(offer.price / 100)
        : 'Indisponível';
      item.append(store, price);
      offers.append(item);
    }
    prices.replaceChildren();
    if (summary.textContent) prices.append(summary);
    prices.append(offers);
  }).catch(() => {
    prices.textContent = 'Não foi possível consultar os preços. Confira se o SaveMe está rodando.';
  });
})();
