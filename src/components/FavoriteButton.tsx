import { useState } from 'react';
import { useSessionReady, useUser } from '../services/auth';
import { useFavorites, type FavoriteGame } from '../services/favorites';

export function FavoriteButton({ game }: { game: FavoriteGame }) {
  const user = useUser();
  const sessionReady = useSessionReady();
  const [loginPrompt, setLoginPrompt] = useState(false);
  const favorites = useFavorites(user?.id);
  const selected = favorites.games?.some(item => item.id === game.id) ?? false;
  const needsLogin = favorites.sessionExpired || (!user && loginPrompt);

  return <div className="mt-4">
    <button type="button" aria-pressed={selected} disabled={!sessionReady || Boolean(favorites.pending) || Boolean(user && !favorites.games && !favorites.sessionExpired)}
      onClick={() => {
        if (!user || favorites.sessionExpired) setLoginPrompt(true);
        else void favorites.change(game, !selected);
      }} className="rounded-lg border border-brand-purple px-4 py-2 font-semibold text-brand-purple disabled:opacity-60">
      {favorites.pending ? 'Atualizando favorito…' : selected ? 'Remover dos favoritos' : 'Favoritar'}
    </button>
    {user && !favorites.games && !favorites.error && !favorites.sessionExpired && <p role="status" className="mt-2 text-sm">Carregando favorito…</p>}
    {needsLogin && <p role="status" className="mt-2 text-sm">Entre na sua conta para favoritar. <a href="#/login">Ir para o login</a></p>}
    {favorites.error && <><p role="alert" className="mt-2 !text-red-800">{favorites.error}</p>
      <button type="button" onClick={favorites.reload} className="font-semibold text-brand-purple">Recarregar favoritos</button></>}
    {favorites.actionError && <p role="alert" className="mt-2 !text-red-800">{favorites.actionError}</p>}
  </div>;
}
