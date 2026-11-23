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

  const params = new URLSearchParams({ q: title });
  const link = document.createElement('a');
  link.className = 'saveme-games-compare-link';
  link.href = new URL(`/#/comparacao?${params}`, saveMeOrigin).href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Comparar no SaveMe';
  document.body.append(link);
})();
