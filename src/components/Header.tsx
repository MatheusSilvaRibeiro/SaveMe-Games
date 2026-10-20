import { useEffect, useRef, useState } from 'react';
import { Brand } from './Brand';

interface HeaderProps { currentPath: string; }
const navigation = [['/', 'Início'], ['/busca', 'Buscar jogos'], ['/comparacao', 'Comparar preços']] as const;

export function Header({ currentPath }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-8 px-6 lg:px-10">
        <Brand />
        <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
          {navigation.map(([href, label]) => (
            <a key={href} href={`#${href}`} aria-current={currentPath === href ? 'page' : undefined}
              className={`relative flex min-h-24 items-center text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full ${currentPath === href ? 'text-brand-purple after:bg-brand-purple' : 'text-slate-600 hover:text-brand-purple'}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-6 md:flex">
          <a href="#/login" aria-current={currentPath === '/login' ? 'page' : undefined} className="rounded-sm text-sm font-semibold text-slate-600 transition-colors hover:text-brand-purple aria-[current=page]:text-brand-purple">Entrar</a>
          <a href="#/cadastro" aria-current={currentPath === '/cadastro' ? 'page' : undefined} className="rounded-lg bg-brand-purple px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-900">Criar conta <span aria-hidden="true" className="ml-2">↗</span></a>
        </div>
        <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="menu-mobile" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)} className="flex size-11 items-center justify-center rounded-lg border border-slate-200 text-night hover:bg-cloud md:hidden">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      <nav id="menu-mobile" aria-label="Navegação móvel" hidden={!menuOpen} className="border-t border-slate-100 px-6 pb-6 pt-3 md:hidden">
        {[...navigation, ['/login', 'Entrar'], ['/cadastro', 'Criar conta']].map(([href, label]) => (
          <a key={href} href={`#${href}`} onClick={() => setMenuOpen(false)} aria-current={currentPath === href ? 'page' : undefined} className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-cloud aria-[current=page]:bg-violet-50 aria-[current=page]:text-brand-purple">{label}</a>
        ))}
      </nav>
    </header>
  );
}
