import { BadRequestException, Controller, Delete, Get, Header, HttpCode, Inject, NotFoundException, Param, Put, Req } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AuthService, checkWriteOrigin } from './auth.js';
import { DatabaseService } from './database.js';

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
      select: { game: { select: { id: true, name: true, edition: true, platform: true, imageUrl: true } } },
      orderBy: [{ createdAt: 'desc' }, { gameId: 'asc' }],
    });
    return rows.map(({ game }) => ({
      id: game.id, nome: game.name, edicao: game.edition, plataforma: game.platform, imagem: game.imageUrl,
    }));
  }

  private async checkWrite(req: Request, gameId: string) {
    const user = await this.auth.requireUser(req);
    checkWriteOrigin(req);
    if (gameId.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) {
      throw new BadRequestException('Identificador de jogo inválido.');
    }
    return user.id;
  }

  @Put(':gameId')
  @HttpCode(204)
  async add(@Req() req: Request, @Param('gameId') gameId: string) {
    const userId = await this.checkWrite(req, gameId);
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
