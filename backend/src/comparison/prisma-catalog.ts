import { ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DatabaseService } from '../database.js';
import type { GameAssociation, GameAssociationRepository } from './catalog.js';
import type { ComparisonResult } from './service.js';
import { observationFromOffer, persistPriceObservations } from './price-observation.js';

type GameWithOffers = Prisma.GameGetPayload<{ include: { offers: true } }>;

function toAssociation(game: GameWithOffers | null): GameAssociation | null {
  if (!game || game.platform !== 'PC') return null;
  const steam = game.offers.find(offer => offer.storeCode === 'steam');
  const epic = game.offers.find(offer => offer.storeCode === 'epic');
  if (steam?.steamAppId == null || !epic?.epicOfferId || !epic.epicNamespace || !epic.epicPageSlug) return null;
  return {
    id: game.id,
    nome: game.name,
    edicao: game.edition,
    plataforma: game.platform,
    ...(game.imageUrl === null ? {} : { imagem: game.imageUrl }),
    steam: { appId: Number(steam.steamAppId) },
    epic: { offerId: epic.epicOfferId, namespace: epic.epicNamespace, pageSlug: epic.epicPageSlug },
  };
}

export class PrismaGameAssociations implements GameAssociationRepository {
  constructor(private readonly db: DatabaseService) {}

  private async query<T>(operation: () => Promise<T>): Promise<T> {
    try {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente.');
      return await operation();
    } catch (cause) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'CATALOG_UNAVAILABLE',
        message: 'O banco de dados da comparação está indisponível no momento. Tente novamente mais tarde.',
      }, { cause });
    }
  }

  async list() {
    const games = await this.query(() => this.db.game.findMany({
      include: { offers: true }, orderBy: [{ catalogOrder: 'asc' }, { id: 'asc' }],
    }));
    return games.map(toAssociation).filter(game => game !== null);
  }

  async findById(id: string) {
    return toAssociation(await this.query(() => this.db.game.findUnique({
      where: { id }, include: { offers: true },
    })));
  }

  async findBySteamAppId(appId: number) {
    const offer = await this.query(() => this.db.storeOffer.findUnique({
      where: { steamAppId: BigInt(appId) }, include: { game: { include: { offers: true } } },
    }));
    return toAssociation(offer?.game ?? null);
  }

  async recordPrices({ jogo, ofertas, regiao, moeda }: ComparisonResult) {
    const observed = ofertas.flatMap(offer => {
      const observation = observationFromOffer(offer, moeda, regiao);
      return observation ? [{ loja: offer.loja, ...observation }] : [];
    });
    if (!observed.length) return;
    await this.query(() => this.db.$transaction(async tx => {
      const stored = await tx.storeOffer.findMany({ where: { gameId: jogo.id } });
      const data = observed.map(({ loja, ...observation }) => {
        const identity = stored.find(row => loja === 'Steam'
          ? row.steamAppId === BigInt(jogo.steam.appId)
          : row.epicNamespace === jogo.epic.namespace && row.epicOfferId === jogo.epic.offerId);
        if (!identity) throw new Error('A associação mudou durante a comparação.');
        return { offerId: identity.id, ...observation };
      });
      await persistPriceObservations(tx, data);
    }, { isolationLevel: 'ReadCommitted' }));
  }
}
