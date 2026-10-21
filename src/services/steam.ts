export interface SearchItem {
  appId: number; nome: string; imagem: string | null; link: string;
  precoCentavos?: number | null; precoOriginalCentavos?: number | null; descontoPercentual?: number | null;
  metacritic?: number | null; sistemas?: string[]; generos?: string[];
  situacaoPreco?: 'informado' | 'gratuito' | 'indisponivel';
}
export interface GameDetails extends SearchItem {
  tipo: string | null; loja: string; regiao: string; moeda: string | null;
  generos?: string[]; desenvolvedoras?: string[]; lancamento?: string | null; emBreve?: boolean;
  precoCentavos: number | null; situacaoPreco: 'informado' | 'gratuito' | 'indisponivel'; consultadoEm: string;
}
interface SearchResponse { termo: string; resultados: SearchItem[]; proximaPagina?: number | null; total?: number; }
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Este conteúdo está indisponível nesta consulta.');
      if (response.status === 400) throw new Error('Confira os dados da pesquisa e tente novamente.');
      throw new Error('Não foi possível consultar a Steam agora. Tente novamente em instantes.');
    }
    return await response.json() as T;
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof TypeError) throw new Error('Não foi possível conectar ao serviço de busca. Tente novamente.');
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('A consulta demorou demais. Tente novamente.');
    if (error instanceof SyntaxError) throw new Error('O serviço retornou uma resposta inválida. Tente novamente.');
    throw error;
  }
}

export async function searchGames(term: string, signal: AbortSignal): Promise<SearchResponse> {
  const data = await request<SearchResponse>(`/steam/games?q=${encodeURIComponent(term)}`, signal);
  if (!data || !Array.isArray(data.resultados) || data.resultados.some(item => !item || !Number.isSafeInteger(item.appId) || item.appId <= 0 || typeof item.nome !== 'string')) {
    throw new Error('A busca retornou dados inválidos. Tente novamente.');
  }
  return data;
}

export async function getFeatured(signal: AbortSignal, page = 1): Promise<SearchResponse> {
  const data = await request<SearchResponse>(`/steam/featured${page > 1 ? `?page=${page}` : ''}`, signal);
  if (!data || !Array.isArray(data.resultados)) throw new Error('Não foi possível carregar a seleção de jogos.');
  return data;
}

export async function getGame(appId: number, signal: AbortSignal): Promise<GameDetails> {
  const data = await request<GameDetails>(`/steam/games/${appId}`, signal);
  if (!data || data.appId !== appId || typeof data.nome !== 'string' ||
    (data.tipo !== null && typeof data.tipo !== 'string') ||
    !['informado', 'gratuito', 'indisponivel'].includes(data.situacaoPreco) ||
    (data.precoCentavos !== null && (!Number.isSafeInteger(data.precoCentavos) || data.precoCentavos < 0 || data.moeda !== 'BRL')) ||
    (data.situacaoPreco === 'gratuito' && data.precoCentavos !== 0) ||
    (data.situacaoPreco === 'informado' && data.precoCentavos === null) ||
    (data.situacaoPreco === 'indisponivel' && data.precoCentavos !== null) ||
    typeof data.consultadoEm !== 'string' || Number.isNaN(Date.parse(data.consultadoEm))) {
    throw new Error('A consulta retornou dados inválidos. Tente novamente.');
  }
  return data;
}
