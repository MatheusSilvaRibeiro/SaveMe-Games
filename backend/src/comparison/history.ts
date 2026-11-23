import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database.js';

function boundedInteger(value: unknown, maximum: number, name: string) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new BadRequestException(`Informe ${name} entre 1 e ${maximum}.`);
  }
  return Number(value);
}

@Controller('comparisons')
export class PriceHistoryController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Get('history/:gameId')
  async history(
    @Param('gameId') gameId: string,
    @Query('days') rawDays: unknown = '30',
    @Query('limit') rawLimit: unknown = '120',
  ) {
    if (gameId.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) {
      throw new BadRequestException('Identificador de jogo inválido.');
    }
    const days = boundedInteger(rawDays, 365, 'days');
    const limit = boundedInteger(rawLimit, 500, 'limit');
    const until = new Date();
    const since = new Date(until.getTime() - days * 86400000);
    const region = 'BR';
    const currency = 'BRL';
    if (!process.env.DATABASE_URL) throw new ServiceUnavailableException('O histórico de preços está indisponível no momento.');
    const game = await this.db.game.findUnique({
          where: { id: gameId },
          select: {
            offers: {
              orderBy: { storeCode: 'asc' },
              select: {
                storeCode: true,
                observations: {
                  where: { region, currency, collectedAt: { gte: since, lte: until } },
                  orderBy: { collectedAt: 'desc' },
                  take: limit,
                  select: { priceCents: true, state: true, collectedAt: true, sourceRecordedAt: true },
                },
              },
            },
          },
    }).catch(cause => {
      throw new ServiceUnavailableException('O histórico de preços está indisponível no momento.', { cause });
    });
    if (!game) throw new NotFoundException('Jogo não encontrado no catálogo.');
    return {
      gameId, region, currency, since, until,
      series: game.offers.map(({ storeCode, observations }) => ({
        store: storeCode,
        points: observations.reverse().map(({ priceCents, ...point }) => ({
          ...point, priceCents: priceCents === null ? null : Number(priceCents),
        })),
      })),
    };
  }
}
