import { request } from './steam';
export interface EpicOffer {
  disponibilidade?: 'disponivel' | 'em_breve' | 'fora_regiao' | 'resgate_codigo' | 'sem_preco';
  sistemas?: string[]; precoOriginalCentavos?: number | null; descontoPercentual?: number | null;
  generos?: string[]; emBreve?: boolean;
  id: string; namespace: string; nome: string; imagem: string | null;
  precoCentavos: number | null; moeda: string | null; link: string | null;
  fonte: string; consultadoEm: string; registroPrecoEm: string | null;
}
function validate(offer: EpicOffer): boolean {
  return !!offer && typeof offer.id === 'string' && typeof offer.namespace === 'string' && typeof offer.nome === 'string' && offer.fonte === 'EGData' &&
    (offer.precoCentavos === null || (offer.moeda === 'BRL' && Number.isSafeInteger(offer.precoCentavos) && offer.precoCentavos >= 0)) &&
    (!offer.sistemas || (Array.isArray(offer.sistemas) && offer.sistemas.every(value => typeof value === 'string'))) &&
    (!offer.generos || (Array.isArray(offer.generos) && offer.generos.every(value => typeof value === 'string'))) &&
    (offer.link === null || /^https:\/\/store\.epicgames\.com\/pt-BR\/p\/[a-z0-9-]+$/i.test(offer.link));
}
export async function searchEpic(term: string, signal: AbortSignal, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (term) params.set('q', term);
  try {
    const data = await request<{ resultados: EpicOffer[]; proximaPagina: number | null }>(`/epic/games?${params}`, signal);
    if (!data || !Array.isArray(data.resultados) || !data.resultados.every(validate)) throw new Error();
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Não foi possível consultar a Epic agora. Tente novamente.');
  }
}
export async function getEpicOffer(id: string, signal: AbortSignal): Promise<EpicOffer> {
  const offer = await request<EpicOffer>(`/epic/games/${encodeURIComponent(id)}`, signal);
  if (!validate(offer)) throw new Error('A oferta da Epic retornou dados inválidos.');
  return offer;
}
