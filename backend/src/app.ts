import 'reflect-metadata';
import { Controller, Get, HttpException, Inject, Injectable, Module, Param, Query } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { buscarJogos } from '../../tools/steam/steam-search.mjs';
import { consultarJogo, SteamError } from '../../tools/steam/steam-probe.mjs';

// Os adaptadores da investigação são reutilizados até sua migração para TypeScript.
export interface SteamClient {
  buscarJogos(term: string): Promise<unknown>;
  consultarJogo(appId: string): Promise<unknown>;
}
const STEAM_CLIENT = Symbol('STEAM_CLIENT');

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
  @Get('games') search(@Query('q') query: unknown) { return this.steam.search(query); }
  @Get('games/:appId') details(@Param('appId') appId: string) { return this.steam.details(appId); }
}

@Controller('health')
class HealthController {
  // Verifica somente se a API responde; não garante a saúde da Steam ou de um banco.
  @Get() health() { return { status: 'ok', service: 'saveme-api', steam: 'not_checked' }; }
}

export async function createApp(client: SteamClient = { buscarJogos, consultarJogo }) {
  @Module({
    controllers: [SteamController, HealthController],
    providers: [SteamService, { provide: STEAM_CLIENT, useValue: client }],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] });
  app.enableShutdownHooks();
  return app;
}
