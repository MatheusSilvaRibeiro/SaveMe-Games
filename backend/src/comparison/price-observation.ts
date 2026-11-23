import type { StoreOffer } from '@prisma/client';
import type { ComparisonOffer, OfferIdentity } from './service.js';

const states = { disponivel: 'available', sem_preco: 'price_missing', indisponivel: 'unavailable' } as const;

export function offerIdentity(offer: StoreOffer): OfferIdentity | null {
  if (offer.storeCode === 'steam' && offer.steamAppId !== null) {
    return { store: 'steam', appId: Number(offer.steamAppId) };
  }
  if (offer.storeCode === 'epic' && offer.epicOfferId && offer.epicNamespace && offer.epicPageSlug) {
    return { store: 'epic', offerId: offer.epicOfferId, namespace: offer.epicNamespace, pageSlug: offer.epicPageSlug };
  }
  return null;
}

export function observationFromOffer(offer: ComparisonOffer, currency: 'BRL', region: 'BR') {
  if (offer.situacao === 'erro' || offer.consultadoEm === null) return null;
  return {
    priceCents: offer.precoCentavos === null ? null : BigInt(offer.precoCentavos),
    currency,
    region,
    state: states[offer.situacao],
    collectedAt: new Date(offer.consultadoEm),
    sourceRecordedAt: offer.registroPrecoEm === null ? null : new Date(offer.registroPrecoEm),
  };
}
