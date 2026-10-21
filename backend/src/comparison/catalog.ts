import { readAssociations } from '../../../tools/comparison/associations.mjs';
// Associação conferida do jogo base. Preços são sempre consultados nas integrações.
export interface GameAssociation {
  id: string;
  nome: string;
  edicao: string;
  imagem?: string;
  plataforma: 'PC';
  steam: { appId: number };
  epic: { offerId: string; namespace: string; pageSlug: string };
}
export interface GameAssociationRepository {
  list(): Promise<GameAssociation[]>;
  findById(id: string): Promise<GameAssociation | null>;
}
// Lido a cada consulta: novas associações entram sem rebuild ou reinício da API.
export const fileGameAssociations: GameAssociationRepository = {
  async list() { return readAssociations() as Promise<GameAssociation[]>; },
  async findById(id) { return (await this.list()).find(game => game.id === id) ?? null; },
};
