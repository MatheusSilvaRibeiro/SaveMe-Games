import { existsSync } from 'node:fs';
import { readAssociations } from '../../../tools/comparison/associations.mjs';
import { DatabaseService } from '../database.js';

if (existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL antes de executar a carga do catálogo.');
  const games = await readAssociations();
  const db = new DatabaseService();
  try {
    await db.$transaction(async tx => {
      for (const store of [{ code: 'steam', name: 'Steam' }, { code: 'epic', name: 'Epic Games Store' }] as const) {
        await tx.store.upsert({ where: { code: store.code }, create: store, update: { name: store.name } });
      }
      for (const [catalogOrder, game] of games.entries()) {
        const metadata = {
          name: game.nome, edition: game.edicao, platform: game.plataforma, imageUrl: game.imagem ?? null, catalogOrder,
        };
        await tx.game.upsert({ where: { id: game.id }, create: { id: game.id, ...metadata }, update: metadata });

        const steamIdentity = { gameId: game.id, storeCode: 'steam' as const };
        const steamAppId = BigInt(game.steam.appId);
        const steam = await tx.storeOffer.upsert({
          where: { gameId_storeCode: steamIdentity },
          create: { ...steamIdentity, steamAppId },
          update: {},
        });
        const epicIdentity = { gameId: game.id, storeCode: 'epic' as const };
        const epic = await tx.storeOffer.upsert({
          where: { gameId_storeCode: epicIdentity },
          create: { ...epicIdentity, epicNamespace: game.epic.namespace, epicOfferId: game.epic.offerId, epicPageSlug: game.epic.pageSlug },
          update: { epicPageSlug: game.epic.pageSlug },
        });
        if (steam.steamAppId !== steamAppId || epic.epicNamespace !== game.epic.namespace || epic.epicOfferId !== game.epic.offerId) {
          throw new Error(`Identidade divergente para ${game.id}. Revise a associação antes de atualizar o catálogo.`);
        }
      }
    });
    console.log(`Carga concluída para ${games.length} jogos.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error && !('clientVersion' in error)
    ? error.message
    : 'Falha na carga do catálogo. Confira a conexão, as migrations e as associações existentes.');
  process.exitCode = 1;
});
