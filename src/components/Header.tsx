import { useEffect, useRef, useState } from 'react';
import { Brand } from './Brand';
import { logout, restoreSession, useUser } from '../services/auth';
import { getUnreadAlerts, unreadAlertsChanged } from '../services/alerts';

interface HeaderProps { currentPath: string; }
const navigation = [['/', 'Início'], ['/descobrir', 'Descobrir'], ['/busca', 'Buscar jogos'], ['/comparacao', 'Comparar preços'], ['/favoritos', 'Favoritos'], ['/avisos', 'Avisos'], ['/preferencias', 'Prefer\u00eancias']] as const;

export function Header({ currentPath }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useUser();
  const userId = user?.id;
  const [unread, setUnread] = useState<{ owner: string; count: number }>();
  const [authError, setAuthError] = useState('');
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { void restoreSession(); }, []);
  useEffect(() => {
    if (!userId) return;
    const owner = userId;
    let controller: AbortController;
    function refresh() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      void getUnreadAlerts(signal).then(count => {
        if (!signal.aborted) setUnread({ owner, count });
      }).catch(() => {
        if (!signal.aborted) setUnread(undefined);
      });
    }
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener(unreadAlertsChanged, refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener(unreadAlertsChanged, refresh);
    };
  }, [userId, currentPath]);

  function navigationLabel(href: string, label: string) {
    const count = unread?.owner === userId ? unread?.count ?? 0 : 0;
    return href === '/avisos' && count > 0 ? <>
      {label} <span className="ml-1 rounded-full bg-brand-purple px-2 py-0.5 text-xs text-white">
        {count > 99 ? '99+' : count}<span className="sr-only"> não lidos</span>
      </span>
    </> : label;
  }
  async function signOut() {
    setLeaving(true); setAuthError('');
    try { await logout(); setMenuOpen(false); window.location.hash = '/login'; }
    catch (error) { setAuthError(error instanceof Error ? error.message : 'Não foi possível sair.'); }
    finally { setLeaving(false); }
  }
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenuOpen(false); }, [currentPath]);

  function closeOnEscape(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <header onKeyDown={closeOnEscape} className="relative z-20 border-b border-slate-200 bg-white">
      <a href="#conteudo" onClick={(event) => { event.preventDefault(); document.getElementById('conteudo')?.focus(); }} className="absolute left-4 top-3 z-30 -translate-y-24 rounded-lg bg-brand-purple px-4 py-3 text-sm font-semibold text-white focus:translate-y-0">Pular para o conteúdo</a>
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Brand />
        <nav aria-label="Navegação principal" className="hidden items-center gap-3 xl:gap-6 xl:flex">
          {navigation.map(([href, label]) => (
            <a key={href} href={`#${href}`} aria-current={currentPath === href ? 'page' : undefined}
              className={`relative flex min-h-24 items-center text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full ${currentPath === href ? 'text-brand-purple after:bg-brand-purple' : 'text-slate-600 hover:text-brand-purple'}`}>
              {navigationLabel(href, label)}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 xl:gap-6 xl:flex">
          {user ? <><span className="max-w-40 truncate text-sm text-slate-600">Olá, {user.name}</span><button type="button" disabled={leaving} onClick={signOut} className="rounded-lg bg-brand-purple px-5 py-3 text-sm font-semibold text-white">{leaving ? 'Saindo…' : 'Sair'}</button></> : <>
          <a href="#/login" aria-current={currentPath === '/login' ? 'page' : undefined} className="rounded-sm text-sm font-semibold text-slate-600 transition-colors hover:text-brand-purple aria-[current=page]:text-brand-purple">Entrar</a>
          <a href="#/cadastro" aria-current={currentPath === '/cadastro' ? 'page' : undefined} className="rounded-lg bg-brand-purple px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-900">Criar conta <span aria-hidden="true" className="ml-2">↗</span></a>
          </>}
        </div>
        <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="menu-mobile" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)} className="flex size-11 items-center justify-center rounded-lg border border-slate-200 text-night hover:bg-cloud xl:hidden">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      <nav id="menu-mobile" aria-label="Navegação móvel" hidden={!menuOpen} className="border-t border-slate-100 px-6 pb-6 pt-3 xl:hidden">
        {[...navigation, ...(user ? [] : [['/login', 'Entrar'], ['/cadastro', 'Criar conta']])].map(([href, label]) => (
          <a key={href} href={`#${href}`} onClick={() => setMenuOpen(false)} aria-current={currentPath === href ? 'page' : undefined} className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-cloud aria-[current=page]:bg-violet-50 aria-[current=page]:text-brand-purple">{navigationLabel(href, label)}</a>
        ))}
        {user && <div className="px-4 py-3 text-sm"><p>Olá, {user.name}</p><button type="button" disabled={leaving} onClick={signOut} className="font-semibold text-brand-purple">{leaving ? 'Saindo…' : 'Sair'}</button></div>}
      </nav>
      {authError && <p role="alert" className="px-6 py-3 text-sm text-red-800">{authError}</p>}
    </header>
  );
}
