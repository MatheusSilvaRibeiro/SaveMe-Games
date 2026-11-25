import { useState } from 'react';
import { useSessionReady, useUser } from '../services/auth';
import { useFavorites, type FavoriteGame } from '../services/favorites';

export function FavoriteButton({ game }: { game: FavoriteGame }) {
  const user = useUser();
  const favorites = useFavorites(user?.id);
  return <FavoriteToggle game={game} favorites={favorites} />;
}

export function FavoriteToggle({ game, favorites, card = false }: {
  game: FavoriteGame;
  favorites: ReturnType<typeof useFavorites>;
  card?: boolean;
}) {
  const user = useUser();
  const sessionReady = useSessionReady();
  const [loginPrompt, setLoginPrompt] = useState(false);
  const selected = favorites.games?.some(item => item.id === game.id) ?? false;
  const needsLogin = favorites.sessionExpired || (!user && loginPrompt);

  return <div className={card ? 'w-full' : 'mt-4'}>
    <button type="button" aria-pressed={selected} disabled={!sessionReady || Boolean(favorites.pending) || Boolean(user && !favorites.games && !favorites.sessionExpired)}
      onClick={() => {
        if (!user || favorites.sessionExpired) setLoginPrompt(true);
        else void favorites.change(game, !selected);
      }} className={`min-h-11 rounded-lg border border-violet-200 px-4 py-2 font-semibold text-brand-purple hover:bg-violet-50 aria-pressed:bg-violet-100 disabled:opacity-60 ${card ? 'w-full text-sm' : ''}`}>
      {favorites.pending === game.id ? 'Atualizando favorito…' : selected ? 'Remover dos favoritos' : card ? 'Adicionar aos favoritos' : 'Favoritar'}
    </button>
    {!card && user && !favorites.games && !favorites.error && !favorites.sessionExpired && <p role="status" className="mt-2 text-sm">Carregando favorito…</p>}
    {needsLogin && <p role="status" className="mt-2 text-sm">Entre na sua conta para favoritar. <a href="#/login">Ir para o login</a></p>}
    {!card && favorites.error && <><p role="alert" className="mt-2 !text-red-800">{favorites.error}</p>
      <button type="button" onClick={favorites.reload} className="font-semibold text-brand-purple">Recarregar favoritos</button></>}
    {!card && favorites.actionError && <p role="alert" className="mt-2 !text-red-800">{favorites.actionError}</p>}
  </div>;
}
