import { useSessionReady, useUser } from '../services/auth';
import { useFavorites } from '../services/favorites';

export function Favoritos() {
  const user = useUser();
  const sessionReady = useSessionReady();
  const favorites = useFavorites(user?.id);

  return <>
    <h1>Meus favoritos</h1>
    <p>Acompanhamos os jogos salvos e mostramos quedas de preço em <a href="#/avisos">Avisos</a> quando uma consulta registra a mudança. A frequência depende das coletas.</p>
    {!sessionReady ? <p role="status">Verificando sua sessão…</p>
      : !user || favorites.sessionExpired ? <p>Entre na sua conta para ver seus favoritos. <a href="#/login">Ir para o login</a></p>
      : favorites.error ? <div>
        <p role="alert" className="!text-red-800">{favorites.error}</p>
        <button type="button" onClick={favorites.reload} className="rounded-lg border border-slate-300 px-4 py-2">Tentar novamente</button>
      </div>
      : !favorites.games ? <p role="status">Carregando seus favoritos…</p>
      : favorites.games.length === 0 ? <p>Você ainda não tem jogos favoritos. <a href="#/comparacao">Ver jogos para comparar</a></p>
      : <ul aria-label="Jogos favoritos" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.games.map(game => <li key={game.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {game.imagem && <img src={game.imagem} alt="" loading="lazy" className="aspect-[231/87] w-full object-cover" />}
          <div className="p-5">
            <h2 className="text-xl font-semibold">{game.nome}</h2>
            <p className="mt-2 text-sm">{game.edicao} · {game.plataforma}</p>
            <div className="flex flex-wrap items-center gap-4">
              <a href={`#/comparacao/${game.id}`}>Comparar preços</a>
              <button type="button" disabled={Boolean(favorites.pending)} aria-label={`Remover ${game.nome} dos favoritos`}
                onClick={() => void favorites.change(game, false)} className="rounded-lg border border-slate-300 px-3 py-2">
                {favorites.pending === game.id ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        </li>)}
      </ul>}
    {favorites.actionError && <p role="alert" className="mt-4 !text-red-800">{favorites.actionError}</p>}
  </>;
}
