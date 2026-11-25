import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Inject, NotFoundException, Param, Put, Req } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AuthService, checkWriteOrigin } from './auth.js';
import { DatabaseService } from './database.js';

const catalogId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const epicFavoriteId = /^epic-[a-z0-9]+(?:[-_][a-z0-9]+)+$/;

function storeGame(gameId: string, body: unknown) {
  const steam = /^steam-([1-9][0-9]{0,9})$/.exec(gameId);
  const epic = epicFavoriteId.test(gameId);
  if ((!steam && !epic) || !body || typeof body !== 'object' || !('nome' in body)) return null;
  const name = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!name || name.length > 200 || name.includes('\0')) throw new BadRequestException('Nome de jogo inválido.');
  const link = 'link' in body && typeof body.link === 'string' ? body.link : '';
  const storeUrl = steam ? `https://store.steampowered.com/app/${steam[1]}/`
    : /^https:\/\/store\.epicgames\.com\/pt-BR\/p\/[a-z0-9-]{1,150}$/i.test(link) ? link
    : `https://store.epicgames.com/pt-BR/browse?q=${encodeURIComponent(name)}&sortBy=relevancy&sortDir=DESC&count=40`;
  return { id: gameId, name, edition: steam ? 'Steam' : 'Epic Games Store', platform: 'PC', storeUrl };
}

@Controller('favorites')
export class FavoritesController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request) {
    const { id: userId } = await this.auth.requireUser(req);
    const rows = await this.db.favorite.findMany({
      where: { userId },
      select: { game: { select: { id: true, name: true, edition: true, platform: true, imageUrl: true, storeUrl: true } } },
      orderBy: [{ createdAt: 'desc' }, { gameId: 'asc' }],
    });
    return rows.map(({ game }) => ({
      id: game.id, nome: game.name, edicao: game.edition, plataforma: game.platform, imagem: game.imageUrl,
      ...(game.storeUrl ? { link: game.storeUrl } : {}),
    }));
  }

  private async checkWrite(req: Request, gameId: string) {
    const user = await this.auth.requireUser(req);
    checkWriteOrigin(req);
    if (gameId.length > 100 || (!catalogId.test(gameId) && !epicFavoriteId.test(gameId))) {
      throw new BadRequestException('Identificador de jogo inválido.');
    }
    return user.id;
  }

  @Put(':gameId')
  @HttpCode(204)
  async add(@Req() req: Request, @Param('gameId') gameId: string, @Body() body: unknown) {
    const userId = await this.checkWrite(req, gameId);
    const standalone = storeGame(gameId, body);
    if (standalone) {
      await this.db.$transaction(async tx => {
        await tx.game.createMany({ data: standalone, skipDuplicates: true });
        await tx.favorite.createMany({ data: { userId, gameId }, skipDuplicates: true });
      });
      return;
    }
    try {
      await this.db.favorite.createMany({ data: { userId, gameId }, skipDuplicates: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003' &&
        !await this.db.game.findUnique({ where: { id: gameId }, select: { id: true } })) {
        throw new NotFoundException('Jogo não encontrado no catálogo.');
      }
      throw error;
    }
  }

  @Delete(':gameId')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('gameId') gameId: string) {
    const userId = await this.checkWrite(req, gameId);
    const game = await this.db.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) throw new NotFoundException('Jogo não encontrado no catálogo.');
    await this.db.favorite.deleteMany({ where: { userId, gameId } });
  }
}
