globalThis.SaveMeShow = ({ title, message, automatic = false }) => {
  if (document.getElementById('saveme-games-panel')) return;
  const panel = document.createElement('aside'); panel.id = 'saveme-games-panel'; panel.className = 'saveme-games-panel'; panel.setAttribute('aria-label', 'Ofertas do SaveMe Games');
  const close = document.createElement('button'); close.textContent = 'Fechar'; close.setAttribute('aria-label', 'Fechar SaveMe'); close.onclick = () => panel.remove();
  const heading = document.createElement('strong'); heading.textContent = title;
  const image = document.createElement('img'); image.alt = ''; image.hidden = true;
  const prices = document.createElement('div'); prices.className = 'saveme-games-prices'; prices.setAttribute('role', 'status');
  prices.textContent = automatic ? 'Consultando ofertas...' : 'Consulte ofertas para esta pesquisa quando quiser. A busca só será enviada ao SaveMe ao clicar.';
  const link = document.createElement('a'); link.className = 'saveme-games-compare-link'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Ver no SaveMe';
  link.href = SaveMeConfig.site + '/#/comparacao?' + new URLSearchParams({ q: title });
  const load = document.createElement('button'); load.className = 'saveme-games-compare-link'; load.textContent = 'Consultar ofertas';
  panel.append(close, heading, image, prices, load, link); document.body.append(panel);
  async function consult() {
    load.disabled = true; prices.textContent = 'Consultando ofertas. O primeiro acesso pode levar cerca de um minuto...';
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response?.error === 'NO_EXACT_MATCH') { prices.textContent = 'Não encontramos uma correspondencia única do jogo base. Abra o SaveMe para selecionar o título correto.'; return; }
      if (response?.error || !response?.result) throw new Error();
      const result = response.result; heading.textContent = result.name;
      if (typeof result.link === 'string' && result.link.startsWith(SaveMeConfig.site + '/#/')) link.href = result.link;
      if (typeof result.image === 'string' && result.image.startsWith('https://')) { image.src = result.image; image.hidden = false; }
      const summary = document.createElement('p');
      summary.textContent = result.cheapest.length > 1 ? 'Mesmo preço nas duas lojas' : result.cheapest.length ? `Menor preço consultado: ${result.cheapest[0]}` : 'Comparação entre lojas indisponivel para este título. Confira a oferta da Steam.';
      const list = document.createElement('ul'); const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
      for (const offer of result.offers) {
        const item = document.createElement('li'), store = document.createElement('span'), price = document.createElement('strong');
        store.textContent = offer.store; price.textContent = Number.isSafeInteger(offer.price) && offer.price >= 0 ? offer.price === 0 ? 'Grátis nesta oferta' : money.format(offer.price / 100) : 'Preço indisponivel';
        item.append(store, price); list.append(item);
      }
      prices.replaceChildren(summary, list);
    } catch { prices.textContent = 'Não foi possível consultar o SaveMe agora. Tente novamente.'; }
    finally { load.disabled = false; load.textContent = 'Consultar novamente'; }
  }
  load.onclick = consult;
  if (automatic) void consult();
};
