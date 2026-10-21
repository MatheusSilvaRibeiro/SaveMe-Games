import { getFeatured, getGame, searchGames, type SearchItem } from './steam';
import { getEpicOffer, searchEpic, type EpicOffer } from './epic';
export const titleKey = (name: string) => name.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
export interface Candidate { key: string; nome: string; imagem: string | null; steam?: SearchItem; epic?: EpicOffer; ambiguous?: boolean; }
export interface Offer { store: 'Steam' | 'Epic'; price: number | null; original?: number | null; link: string | null; checked: string; recorded?: string | null; }
export async function findComparisons(term: string, signal: AbortSignal) {
  const [steam, epic] = await Promise.allSettled([(term ? searchGames(term, signal) : getFeatured(signal)), searchEpic(term, signal)]);
  const groups = new Map<string, Candidate>();
  const add = (item: SearchItem | EpicOffer, store: 'steam' | 'epic') => {
    const key = titleKey(item.nome);
    const group = groups.get(key) ?? { key, nome: item.nome, imagem: item.imagem };
    if (group[store]) { group.ambiguous = true; return; }
    Object.assign(group, { [store]: item }); groups.set(key, group);
  };
  if (steam.status === 'fulfilled') steam.value.resultados.forEach(item => add(item, 'steam'));
  if (epic.status === 'fulfilled') epic.value.resultados.forEach(item => add(item, 'epic'));
  const games = [...groups.values()].sort((a, b) => Number(!!b.steam && !!b.epic) - Number(!!a.steam && !!a.epic));
  return { games: term ? games : games.slice(0, 12), errors: [steam.status === 'rejected' ? 'Steam indisponível nesta busca.' : '', epic.status === 'rejected' ? 'Epic indisponível nesta busca.' : ''].filter(Boolean), more: !!term && epic.status === 'fulfilled' && !!epic.value.proximaPagina };
}
export async function loadComparison(candidate: Candidate, signal: AbortSignal) {
  const jobs: { store: 'Steam' | 'Epic'; promise: Promise<Offer> }[] = [];
  if (candidate.steam) jobs.push({ store: 'Steam', promise: getGame(candidate.steam.appId, signal).then(game => {
    if (titleKey(game.nome) !== titleKey(candidate.nome)) throw Error('Título alterado');
    const eligible = game.tipo === 'game' && !game.emBreve && game.regiao === 'BR' && game.moeda === 'BRL';
    return { store: 'Steam', price: eligible ? game.precoCentavos : null, original: game.precoOriginalCentavos, link: `https://store.steampowered.com/app/${game.appId}/`, checked: game.consultadoEm };
  }) });
  if (candidate.epic) jobs.push({ store: 'Epic', promise: getEpicOffer(candidate.epic.id, signal).then(game => {
    if (titleKey(game.nome) !== titleKey(candidate.nome)) throw Error('Título alterado');
    const eligible = !game.emBreve && (!game.disponibilidade || game.disponibilidade === 'disponivel') && game.moeda === 'BRL' && !!game.link;
    return { store: 'Epic', price: eligible ? game.precoCentavos : null, original: game.precoOriginalCentavos, link: game.link, checked: game.consultadoEm, recorded: game.registroPrecoEm };
  }) });
  const result = await Promise.allSettled(jobs.map(job => job.promise));
  return { offers: result.flatMap(item => item.status === 'fulfilled' ? [{ ...item.value, price: candidate.ambiguous ? null : item.value.price }] : []), errors: [...(candidate.ambiguous ? ['Há múltiplas ofertas com o mesmo título. Confira a edição nas lojas; a indicação de menor preço foi suspensa.'] : []), ...result.flatMap((item, index) => item.status === 'rejected' ? [`Não foi possível atualizar ${jobs[index]?.store}. Tente novamente.`] : [])] };
}

