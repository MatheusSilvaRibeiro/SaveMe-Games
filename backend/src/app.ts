import 'reflect-metadata';
import { fileGameAssociations } from './comparison/catalog.js';
import { createComparisonService } from './comparison/service.js';
import { createEpicCatalog } from '../../tools/epic/epic-catalog.mjs';
import { EpicError } from '../../tools/epic/epic-probe.mjs';
import { Controller, Get, HttpException, Inject, Injectable, Module, Param, Query } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.js';
import { createCatalog } from '../../tools/steam/steam-catalog.mjs';
import { buscarJogos } from '../../tools/steam/steam-search.mjs';
import { consultarJogo, SteamError } from '../../tools/steam/steam-probe.mjs';

// Os adaptadores da investigação são reutilizados até sua migração para TypeScript.
export interface SteamClient {
  buscarJogos(term: string): Promise<unknown>;
  consultarJogo(appId: string): Promise<unknown>;
  featured?(page: number): Promise<unknown>;
}
const STEAM_CLIENT = Symbol('STEAM_CLIENT');
const EPIC_CLIENT = Symbol('EPIC_CLIENT');
const COMPARISON_SERVICE = Symbol('COMPARISON_SERVICE');
@Controller('comparisons')
class ComparisonController {
  constructor(@Inject(COMPARISON_SERVICE) private readonly comparison: ReturnType<typeof createComparisonService>) {}
  @Get('games') list() { return this.comparison.list(); }
  @Get(':gameId') compare(@Param('gameId') id: string) { return this.comparison.compare(id); }
}
interface EpicClient {
  search(term: string, options?: { page?: number }): Promise<unknown>;
  list(options?: { page?: number }): Promise<unknown>;
  details(id: string): Promise<unknown>;
}
@Controller('epic')
class EpicController {
  constructor(@Inject(EPIC_CLIENT) private readonly client: EpicClient) {}
  private async execute(operation: () => Promise<unknown>) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof EpicError)) throw error;
      const statuses: Record<string, number> = { INVALID_QUERY: 400, INVALID_ID: 400, UNAVAILABLE: 404, INCOMPATIBLE_OFFER: 400, RATE_LIMITED: 503, TIMEOUT: 504, NETWORK_ERROR: 503 };
      const status = statuses[error.code] ?? 502;
      throw new HttpException({ statusCode: status, code: error.code, message: error.message }, status);
    }
  }
  @Get('games') search(@Query('q') q: unknown, @Query('page') page: unknown = '1') {
    if (typeof page !== 'string' || !/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) < 1 ||
      (q !== undefined && (typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 100))) throw new HttpException('Pesquisa inválida.', 400);
    return this.execute(() => typeof q === 'string' ? this.client.search(q.trim(), { page: Number(page) }) : this.client.list({ page: Number(page) }));
  }
  @Get('games/:offerId') details(@Param('offerId') id: string) {
    return this.execute(() => this.client.details(id));
  }
}

@Injectable()
class SteamService {
  constructor(@Inject(STEAM_CLIENT) private readonly client: SteamClient) {}

  private async execute(operation: () => Promise<unknown>) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof SteamError)) throw error;
      const status: Record<string, number> = {
        INVALID_QUERY: 400, INVALID_ID: 400, UNAVAILABLE: 404,
        TIMEOUT: 504, NETWORK_ERROR: 503, HTTP_ERROR: 502, INVALID_RESPONSE: 502,
      };
      throw new HttpException({
        statusCode: status[error.code] ?? 502,
        code: error.code,
        message: error.message,
      }, status[error.code] ?? 502);
    }
  }

  featured(page: unknown = '1') {
    if (typeof page !== 'string' || !/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) < 1) {
      throw new HttpException({ statusCode: 400, code: 'INVALID_QUERY', message: 'Página inválida.' }, 400);
    }
    return this.execute(() => this.client.featured ? this.client.featured(Number(page)) : Promise.resolve({ resultados: [] }));
  }

  search(term: unknown) {
    if (typeof term !== 'string' || term.trim().length < 2 || term.trim().length > 100) {
      throw new HttpException({ statusCode: 400, code: 'INVALID_QUERY', message: 'Digite entre 2 e 100 caracteres em q.' }, 400);
    }
    return this.execute(() => this.client.buscarJogos(term.trim()));
  }

  details(id: string) {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
      throw new HttpException({ statusCode: 400, code: 'INVALID_ID', message: 'Informe um AppID inteiro positivo.' }, 400);
    }
    return this.execute(() => this.client.consultarJogo(id));
  }
}

@Controller('steam')
class SteamController {
  constructor(@Inject(SteamService) private readonly steam: SteamService) {}
  @Get('featured') featured(@Query('page') page?: unknown) { return this.steam.featured(page); }
  @Get('games') search(@Query('q') query: unknown) { return this.steam.search(query); }
  @Get('games/:appId') details(@Param('appId') appId: string) { return this.steam.details(appId); }
}

@Controller('health')
class HealthController {
  // Verifica somente se a API responde; não garante a saúde da Steam ou de um banco.
  @Get() health() { return { status: 'ok', service: 'saveme-api', steam: 'not_checked' }; }
}

export async function createApp(client?: SteamClient, epicClient: EpicClient = createEpicCatalog()) {
  const catalog = createCatalog();
  const steamClient: SteamClient = client ?? {
    buscarJogos: async term => catalog.enrich(await buscarJogos(term)),
    consultarJogo: id => catalog.details(id),
    featured: page => catalog.featured(page),
  };
  @Module({
    imports: [AuthModule],
    controllers: [SteamController, HealthController, EpicController, ComparisonController],
    providers: [{ provide: COMPARISON_SERVICE, useValue: createComparisonService(fileGameAssociations, { steam: id => steamClient.consultarJogo(id), epic: id => epicClient.details(id) }) }, { provide: EPIC_CLIENT, useValue: epicClient }, SteamService, { provide: STEAM_CLIENT, useValue: steamClient }],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.AUTH_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()), credentials: true });
  app.enableShutdownHooks();
  return app;
}
