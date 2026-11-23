import { useEffect, useState } from 'react';

export interface FavoriteGame {
  id: string;
  nome: string;
  edicao: string;
  plataforma: string;
  imagem?: string | null;
}

const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
type Snapshot = { owner: string; games?: FavoriteGame[]; error?: string; sessionExpired?: boolean };
type Mutation = { owner: string; pending?: string; error?: string; sessionExpired?: boolean };

async function request(signal: AbortSignal, game?: FavoriteGame, method?: 'PUT' | 'DELETE') {
  return fetch(`${base}/favorites${game ? '/' + encodeURIComponent(game.id) : ''}`, {
    credentials: 'include',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    ...(method ? { method, headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
  });
}

export function useFavorites(userId: string | undefined) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [mutation, setMutation] = useState<Mutation>();
  const [retry, setRetry] = useState(0);
  const [lifetime, setLifetime] = useState<AbortSignal>();

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLifetime(signal);
    setSnapshot({ owner: userId });
    setMutation(undefined);
    void (async () => {
      try {
        const response = await request(signal);
        if (signal.aborted) return;
        if (response.status === 401) {
          setSnapshot({ owner: userId, sessionExpired: true });
          return;
        }
        if (!response.ok) throw new Error();
        const games: FavoriteGame[] = await response.json();
        if (!Array.isArray(games)) throw new Error();
        if (!signal.aborted) setSnapshot({ owner: userId, games });
      } catch {
        if (!signal.aborted) setSnapshot({ owner: userId, error: 'Não foi possível carregar seus favoritos.' });
      }
    })();
    return () => controller.abort();
  }, [userId, retry]);

  const current = snapshot?.owner === userId ? snapshot : undefined;
  const action = mutation?.owner === userId ? mutation : undefined;

  async function change(game: FavoriteGame, favorite: boolean) {
    if (!userId || !lifetime || lifetime.aborted || action?.pending || !current?.games) return;
    setMutation({ owner: userId, pending: game.id });
    try {
      const response = await request(lifetime, game, favorite ? 'PUT' : 'DELETE');
      if (lifetime.aborted) return;
      if (response.status === 401) {
        setMutation({ owner: userId, sessionExpired: true });
        return;
      }
      if (!response.ok) throw new Error();
      setSnapshot(previous => previous?.owner === userId && previous.games
        ? { ...previous, games: favorite ? [game, ...previous.games.filter(item => item.id !== game.id)]
          : previous.games.filter(item => item.id !== game.id) }
        : previous);
      setMutation(undefined);
    } catch {
      if (!lifetime.aborted) setMutation({ owner: userId, error: 'Não foi possível atualizar seus favoritos. Tente novamente.' });
    }
  }

  return {
    games: current?.games,
    error: current?.error,
    actionError: action?.error,
    sessionExpired: current?.sessionExpired || action?.sessionExpired,
    pending: action?.pending,
    reload: () => setRetry(value => value + 1),
    change,
  };
}
