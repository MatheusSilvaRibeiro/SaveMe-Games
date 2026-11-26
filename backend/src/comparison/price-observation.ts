import { Prisma, type StoreOffer } from '@prisma/client';
import { offerStoreUrl, type ComparisonOffer, type OfferIdentity } from './service.js';

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

export async function persistPriceObservations(tx: Prisma.TransactionClient, data: Prisma.PriceObservationCreateManyInput[]) {
  if (!data.length) return 0;
  const offerIds = [...new Set(data.map(row => row.offerId))];
  // As duas origens de escrita serializam pelo ID da oferta, na mesma ordem.
  await tx.$queryRaw`
    SELECT id FROM store_offers WHERE id IN (${Prisma.join(offerIds.map(id => Prisma.sql`${id}::uuid`))})
    ORDER BY id FOR UPDATE
  `;
  const inserted = await tx.priceObservation.createManyAndReturn({ data, skipDuplicates: true });

  for (const observation of inserted) {
    if (observation.state !== 'available' || observation.priceCents === null) continue;
    const { id, offerId, region, currency, collectedAt, priceCents } = observation;
    const previous = await tx.priceObservation.findFirst({
      where: { offerId, region, currency, state: 'available', collectedAt: { lt: collectedAt } },
      orderBy: { collectedAt: 'desc' }, select: { priceCents: true },
    });
    const previousPriceCents = previous?.priceCents;
    if (previousPriceCents == null || previousPriceCents <= priceCents) continue;
    const offer = await tx.storeOffer.findUniqueOrThrow({
      where: { id: offerId }, include: { game: { select: { id: true, name: true } } },
    });
    const identity = offerIdentity(offer);
    if (!identity) throw new Error('Oferta sem identidade válida para o aviso de preço.');
    const recipients = await tx.favorite.findMany({
      where: { gameId: offer.game.id, createdAt: { lt: collectedAt }, user: { priceAlertsEnabled: true } }, select: { userId: true },
    });
    if (!recipients.length) continue;
    await tx.priceAlert.createMany({
      data: recipients.map(({ userId }) => ({
        userId, offerId, observationId: id, gameId: offer.game.id, gameName: offer.game.name,
        store: offer.storeCode, storeUrl: offerStoreUrl(identity), region, currency,
        previousPriceCents, newPriceCents: priceCents, observedAt: collectedAt,
      })),
      skipDuplicates: true,
    });
  }
  return inserted.length;
}
