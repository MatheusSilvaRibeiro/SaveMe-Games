import { BadRequestException, Body, Controller, Get, Header, Inject, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, checkWriteOrigin } from './auth.js';
import { DatabaseService } from './database.js';

@Controller('preferences')
export class PreferencesController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() req: Request) {
    const user = await this.auth.requireUser(req);
    return this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: { priceAlertsEnabled: true } });
  }
  @Patch()
  async update(@Req() req: Request, @Body() body: unknown) {
    const user = await this.auth.requireUser(req);
    checkWriteOrigin(req);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !('priceAlertsEnabled' in body) || typeof body.priceAlertsEnabled !== 'boolean') {
      throw new BadRequestException('Informe somente priceAlertsEnabled como booleano.');
    }
    return this.db.user.update({ where: { id: user.id }, data: { priceAlertsEnabled: body.priceAlertsEnabled }, select: { priceAlertsEnabled: true } });
  }
}
