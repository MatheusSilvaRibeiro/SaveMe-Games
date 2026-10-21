import { HttpException } from '@nestjs/common';
import type { GameAssociation, GameAssociationRepository } from './catalog.js';

export interface ComparisonSources {
  steam(id: string): Promise<unknown>;
  epic(id: string): Promise<unknown>;
}
export interface ComparisonOffer {
  loja: 'Steam' | 'Epic Games Store';
  fonte: 'Steam' | 'EGData';
  situacao: 'disponivel' | 'sem_preco' | 'indisponivel' | 'erro';
  precoCentavos: number | null;
  moeda: 'BRL' | null;
  precoOriginalCentavos: number | null;
  descontoPercentual: number | null;
  link: string;
  consultadoEm: string | null;
  registroPrecoEm: string | null;
  mensagem: string | null;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Resposta inválida.');
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}
function baseOffer(game: GameAssociation, store: 'steam' | 'epic'): ComparisonOffer {
  return {
    loja: store === 'steam' ? 'Steam' : 'Epic Games Store', fonte: store === 'steam' ? 'Steam' : 'EGData',
    situacao: 'erro', precoCentavos: null, moeda: null, precoOriginalCentavos: null, descontoPercentual: null,
    link: store === 'steam' ? `https://store.steampowered.com/app/${game.steam.appId}/` : `https://store.epicgames.com/pt-BR/p/${game.epic.pageSlug}`,
    consultadoEm: null, registroPrecoEm: null, mensagem: null,
  };
}
function normalize(game: GameAssociation, store: 'steam' | 'epic', value: unknown): ComparisonOffer {
  const data = record(value);
  if (store === 'steam' ? data.appId !== game.steam.appId || data.tipo !== 'game'
    : data.id !== game.epic.offerId || data.namespace !== game.epic.namespace || data.tipoOferta !== 'BASE_GAME' || data.somenteMobile === true) {
    throw new Error('A resposta não corresponde ao jogo base associado.');
  }
  const result = baseOffer(game, store);
  const consulted = timestamp(data.consultadoEm);
  if (data.regiao !== 'BR' || !consulted) throw new Error('Região ou horário da resposta inválidos.');
  result.consultadoEm = consulted;
  result.registroPrecoEm = store === 'epic' ? timestamp(data.registroPrecoEm) : null;
  if (data.emBreve === true || ['fora_regiao', 'resgate_codigo', 'em_breve'].includes(String(data.disponibilidade))) {
    return { ...result, situacao: 'indisponivel', mensagem: 'Oferta sem disponibilidade de compra nesta consulta para o Brasil.' };
  }
  if (data.precoCentavos === null) return { ...result, situacao: 'sem_preco', mensagem: 'Preço não informado para o Brasil.' };
  if (!Number.isSafeInteger(data.precoCentavos) || Number(data.precoCentavos) < 0 || data.moeda !== 'BRL' ||
    !['informado', 'gratuito', 'gratuito_nesta_oferta'].includes(String(data.situacaoPreco))) throw new Error('Preço inválido.');
  const price = Number(data.precoCentavos);
  if (['gratuito', 'gratuito_nesta_oferta'].includes(String(data.situacaoPreco)) && price !== 0) throw new Error('Preço gratuito inconsistente.');
  const original = Number.isSafeInteger(data.precoOriginalCentavos) && Number(data.precoOriginalCentavos) > price ? Number(data.precoOriginalCentavos) : null;
  return { ...result, situacao: 'disponivel', precoCentavos: price, moeda: 'BRL', precoOriginalCentavos: original, descontoPercentual: original === null ? null : Math.round((1 - price / original) * 100) };
}
export function createComparisonService(repository: GameAssociationRepository, sources: ComparisonSources) {
  const pending = new Map<string, Promise<ComparisonResult>>();
  const cache = new Map<string, { expires: number; value: ComparisonResult }>();
  async function load(game: GameAssociation) {
    const settled = await Promise.allSettled([
      Promise.resolve().then(() => sources.steam(String(game.steam.appId))),
      Promise.resolve().then(() => sources.epic(game.epic.offerId)),
    ]);
    const offers = settled.map((entry, index) => {
      const store = index === 0 ? 'steam' : 'epic';
      try {
        if (entry.status === 'rejected') throw entry.reason;
        return normalize(game, store, entry.value);
      } catch (error) {
        const unavailable = error && typeof error === 'object' && 'code' in error && error.code === 'UNAVAILABLE';
        return { ...baseOffer(game, store), situacao: unavailable ? 'indisponivel' : 'erro', mensagem: unavailable ? 'Oferta indisponível nesta consulta.' : 'Não foi possível consultar esta loja agora.' } as ComparisonOffer;
      }
    }).sort((a, b) => (a.precoCentavos ?? Infinity) - (b.precoCentavos ?? Infinity));
    const priced = offers.filter(offer => offer.situacao === 'disponivel' && offer.precoCentavos !== null);
    const complete = priced.length === offers.length;
    const minimum = complete ? Math.min(...priced.map(offer => offer.precoCentavos!)) : null;
    const result: ComparisonResult = {
      jogo: structuredClone(game), regiao: 'BR', moeda: 'BRL', ofertas: offers,
      situacao: complete ? 'comparavel' : priced.length ? 'parcial' : 'sem_precos',
      menorPrecoCentavos: minimum,
      lojasMenorPreco: complete ? priced.filter(offer => offer.precoCentavos === minimum).map(offer => offer.loja) : [],
      economiaCentavos: complete ? Math.max(...priced.map(offer => offer.precoCentavos!)) - minimum! : null,
    };
    // Cache curto preserva os horários originais. Falhas não ficam retidas por minutos.
    cache.set(game.id, { value: result, expires: Date.now() + (complete ? 60000 : 10000) });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return result;
  }
  return {
    list: () => repository.list(),
    async compare(id: string): Promise<ComparisonResult> {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 100) throw new HttpException('Identificador de jogo inválido.', 400);
      const game = await repository.findById(id);
      if (!game) throw new HttpException('Este jogo ainda não possui associação conferida entre as lojas.', 404);
      const cached = cache.get(id);
      if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
      let operation = pending.get(id);
      if (!operation) {
        operation = load(game).finally(() => pending.delete(id));
        pending.set(id, operation);
      }
      return structuredClone(await operation);
    },
  };
}
export interface ComparisonResult {
  jogo: GameAssociation; regiao: 'BR'; moeda: 'BRL'; ofertas: ComparisonOffer[];
  situacao: 'comparavel' | 'parcial' | 'sem_precos';
  menorPrecoCentavos: number | null; lojasMenorPreco: string[]; economiaCentavos: number | null;
}
