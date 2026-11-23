import { BadRequestException, Controller, Get, Header, HttpCode, Inject, NotFoundException, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, checkWriteOrigin } from './auth.js';
import { DatabaseService } from './database.js';

function alertId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
    throw new BadRequestException('Identificador de aviso inválido.');
  }
  return BigInt(value);
}

@Controller('alerts')
export class PriceAlertsController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request, @Query('limit') size: unknown = '20', @Query('before') before?: unknown) {
    const { id: userId } = await this.auth.requireUser(req);
    if (typeof size !== 'string' || !/^\d{1,2}$/.test(size) || Number(size) < 1 || Number(size) > 50) {
      throw new BadRequestException('Informe limit entre 1 e 50.');
    }
    const limit = Number(size);
    const alerts = await this.db.priceAlert.findMany({
      where: { userId, ...(before === undefined ? {} : { id: { lt: alertId(before) } }) },
      select: {
        id: true, gameId: true, gameName: true, store: true, storeUrl: true, region: true, currency: true,
        previousPriceCents: true, newPriceCents: true, observedAt: true, readAt: true,
      },
      orderBy: { id: 'desc' }, take: limit + 1,
    });
    const items = alerts.slice(0, limit).map(({ id, previousPriceCents, newPriceCents, ...alert }) => ({
      ...alert, id: String(id), previousPriceCents: Number(previousPriceCents), newPriceCents: Number(newPriceCents),
    }));
    return { items, nextCursor: alerts.length > limit ? items.at(-1)!.id : null };
  }

  @Get('unread')
  @Header('Cache-Control', 'private, no-store')
  async unread(@Req() req: Request) {
    const { id: userId } = await this.auth.requireUser(req);
    return { count: await this.db.priceAlert.count({ where: { userId, readAt: null } }) };
  }

  @Patch(':id/read')
  @HttpCode(204)
  async markRead(@Req() req: Request, @Param('id') value: string) {
    const { id: userId } = await this.auth.requireUser(req);
    checkWriteOrigin(req);
    const key = { id: alertId(value), userId };
    const updated = await this.db.priceAlert.updateMany({ where: { ...key, readAt: null }, data: { readAt: new Date() } });
    if (!updated.count && !await this.db.priceAlert.findFirst({ where: key, select: { id: true } })) {
      throw new NotFoundException('Aviso não encontrado.');
    }
  }
}
