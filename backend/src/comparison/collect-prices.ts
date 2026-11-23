import { consultarOfertaEpic } from '../../../tools/epic/epic-details.mjs';
import { consultarJogo } from '../../../tools/steam/steam-probe.mjs';
import type { DatabaseService } from '../database.js';
import { observationFromOffer, offerIdentity } from './price-observation.js';
import { isUnavailable, normalizeOffer, unavailableOffer, type OfferIdentity } from './service.js';

const concurrency = 3;
const requestTimeoutMs = 5000;
const collectionBudgetMs = 240000;

function requestOffer(identity: OfferIdentity) {
  return identity.store === 'steam'
    ? consultarJogo(identity.appId, { fetchImpl: fetch, timeoutMs: requestTimeoutMs })
    : consultarOfertaEpic(identity.offerId, { fetchImpl: fetch, timeoutMs: requestTimeoutMs, namespaceEsperado: identity.namespace });
}

export async function collectPrices(
  db: DatabaseService,
  lookup: (identity: OfferIdentity) => Promise<unknown> = requestOffer,
) {
  return db.$transaction(async tx => {
    // O lock vale para todas as instâncias conectadas ao mesmo banco e termina com a transação.
    const [result] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(736283, 1) AS locked`;
    if (!result.locked) return { status: 'overlap' as const };

    const offers = await tx.storeOffer.findMany({
      include: { game: { select: { edition: true, platform: true } } },
      orderBy: [{ gameId: 'asc' }, { storeCode: 'asc' }],
    });
    if (!offers.length) throw new Error('Não há ofertas cadastradas para coletar.');
    const errors: { gameId: string; store: string; reason: string }[] = [];
    let sampled = 0;
    let inserted = 0;
    let processed = 0;
    const deadline = Date.now() + collectionBudgetMs;

    async function observe(offer: typeof offers[number]) {
      const identity = offerIdentity(offer);
      if (!identity || offer.game.edition !== 'Jogo base' || offer.game.platform !== 'PC') {
        errors.push({ gameId: offer.gameId, store: offer.storeCode, reason: 'INCOMPATIBLE_OFFER' });
        return null;
      }
      try {
        let raw: unknown;
        try { raw = await lookup(identity); }
        catch (error) {
          if (!isUnavailable(error)) throw error;
          const observation = observationFromOffer(unavailableOffer(identity, new Date().toISOString()), 'BRL', 'BR');
          return observation && { offerId: offer.id, ...observation };
        }
        const observation = observationFromOffer(normalizeOffer(identity, raw), 'BRL', 'BR');
        return observation && { offerId: offer.id, ...observation };
      } catch (error) {
        const reason = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
          ? error.code : 'INVALID_OBSERVATION';
        errors.push({ gameId: offer.gameId, store: offer.storeCode, reason });
        return null;
      }
    }

    for (let index = 0; index < offers.length && Date.now() < deadline; index += concurrency) {
      const batch = offers.slice(index, index + concurrency);
      const data = (await Promise.all(batch.map(observe))).filter(row => row !== null);
      processed += batch.length;
      sampled += data.length;
      if (data.length) inserted += (await tx.priceObservation.createMany({ data, skipDuplicates: true })).count;
    }
    return {
      status: 'completed' as const, offers: offers.length, processed,
      inserted, duplicates: sampled - inserted, errors, unprocessed: offers.length - processed,
    };
  }, { maxWait: 5000, timeout: collectionBudgetMs + 30000 });
}
