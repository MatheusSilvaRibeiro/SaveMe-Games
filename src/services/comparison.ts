import { request } from './steam';
export interface ComparableGame {
  imagem?: string;
  id: string; nome: string; edicao: string; plataforma: 'PC';
  steam: { appId: number }; epic: { offerId: string; namespace: string };
}
export interface ComparedOffer {
  loja: 'Steam' | 'Epic Games Store'; fonte: 'Steam' | 'EGData';
  situacao: 'disponivel' | 'sem_preco' | 'indisponivel' | 'erro';
  precoOriginalCentavos?: number | null; descontoPercentual?: number | null;
  precoCentavos: number | null; moeda: 'BRL' | null; link: string;
  consultadoEm: string | null; registroPrecoEm: string | null; mensagem: string | null;
}
export interface Comparison {
  jogo: ComparableGame; ofertas: ComparedOffer[];
  situacao: 'comparavel' | 'parcial' | 'sem_precos';
  menorPrecoCentavos: number | null; economiaCentavos: number | null; lojasMenorPreco: string[];
}
const cents = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) >= 0);
const gameValid = (game: ComparableGame) => !!game && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) && typeof game.nome === 'string' && typeof game.edicao === 'string' && Number.isSafeInteger(game.steam?.appId) && typeof game.epic?.offerId === 'string' && typeof game.epic?.namespace === 'string';
export async function getComparableGames(signal: AbortSignal) {
  const result = await request<ComparableGame[]>('/comparisons/games', signal);
  if (!Array.isArray(result) || !result.every(gameValid)) throw new Error('Não foi possível carregar os jogos disponíveis para comparação.');
  return result;
}
export async function compareGame(id: string, signal: AbortSignal) {
  try {
    const data = await request<Comparison>(`/comparisons/${encodeURIComponent(id)}`, signal);
    if (!data || !gameValid(data.jogo) || data.jogo.id !== id || !['comparavel', 'parcial', 'sem_precos'].includes(data.situacao) ||
      !Array.isArray(data.ofertas) || data.ofertas.length !== 2 || new Set(data.ofertas.map(offer => offer.loja)).size !== 2 ||
      !Array.isArray(data.lojasMenorPreco) || !cents(data.menorPrecoCentavos) || !cents(data.economiaCentavos) ||
      !data.ofertas.every(offer => ['Steam', 'Epic Games Store'].includes(offer.loja) && cents(offer.precoCentavos) &&
        (offer.precoOriginalCentavos == null || (cents(offer.precoOriginalCentavos) && offer.precoCentavos !== null && offer.precoOriginalCentavos > offer.precoCentavos)) &&
        (offer.precoCentavos === null || (offer.moeda === 'BRL' && offer.situacao === 'disponivel')) &&
        ['disponivel', 'sem_preco', 'indisponivel', 'erro'].includes(offer.situacao) &&
        (offer.loja === 'Steam' ? /^https:\/\/store\.steampowered\.com\/app\/\d+\/$/.test(offer.link) : /^https:\/\/store\.epicgames\.com\/pt-BR\/p\/[a-z0-9-]+$/.test(offer.link)))) throw new Error();
    if (data.situacao !== 'comparavel' && (data.economiaCentavos !== null || data.menorPrecoCentavos !== null || data.lojasMenorPreco.length)) throw new Error();
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Não foi possível carregar a comparação. Tente novamente em instantes.');
  }
}
