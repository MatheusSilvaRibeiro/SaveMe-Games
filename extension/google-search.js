(() => {
  if (location.pathname !== '/search') return;
  const query = new URLSearchParams(location.search).get('q')?.trim();
  if (!query) return;
  const title = query.replace(/^(?:pre.o d[eo] |onde comprar )/iu, '').replace(/\s+(?:pre.o|onde comprar)\??$/iu, '').trim();
  if (title.length < 2 || title.length > 100) return;
  SaveMeShow({ title, message: { type: 'saveme:prices', title } });
})();
