import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const slug = value => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export function associationFile() {
  // Fonte e saída compilada do NestJS apontam para o mesmo arquivo versionado.
  const candidates = [new URL('../../data/game-associations.json', import.meta.url), new URL('../../../../data/game-associations.json', import.meta.url)];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) throw new Error('Catálogo de associações ausente. Preserve a pasta data na raiz do projeto.');
  return fileURLToPath(found);
}
export function validateAssociations(games) {
  if (!Array.isArray(games)) throw new Error('O catálogo deve conter uma lista.');
  const ids = new Set(), steamIds = new Set(), epicIds = new Set();
  for (const game of games) {
    const allowed = ['id', 'nome', 'edicao', 'plataforma', 'imagem', 'steam', 'epic'];
    if (!game || typeof game !== 'object' || Object.keys(game).some(key => !allowed.includes(key)) ||
      !slug(game.id) || typeof game.nome !== 'string' || !game.nome.trim() || game.nome.length > 200 ||
      game.edicao !== 'Jogo base' || game.plataforma !== 'PC' ||
      !Number.isSafeInteger(game.steam?.appId) || game.steam.appId <= 0 ||
      typeof game.epic?.offerId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(game.epic.offerId) ||
      typeof game.epic?.namespace !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(game.epic.namespace) || !slug(game.epic?.pageSlug) ||
      (game.imagem !== undefined && (typeof game.imagem !== 'string' || !/^https:\/\//.test(game.imagem))) ||
      Object.keys(game.steam).some(key => key !== 'appId') || Object.keys(game.epic).some(key => !['offerId', 'namespace', 'pageSlug'].includes(key))) {
      throw new Error('Associação inválida: confira identidade, edição, plataforma e campos permitidos. Preços não pertencem a este arquivo.');
    }
    const epicKey = `${game.epic.namespace}:${game.epic.offerId}`;
    if (ids.has(game.id) || steamIds.has(game.steam.appId) || epicIds.has(epicKey)) throw new Error('Já existe associação para este ID, jogo Steam ou oferta Epic. Nenhum registro foi substituído.');
    ids.add(game.id); steamIds.add(game.steam.appId); epicIds.add(epicKey);
  }
  return games;
}
export async function readAssociations(path = associationFile()) {
  return validateAssociations(JSON.parse(await readFile(path, 'utf8')));
}
