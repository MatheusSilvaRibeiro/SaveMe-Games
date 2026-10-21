import { Brand } from './Brand';

const linkStyle = 'w-fit rounded-sm text-sm text-slate-300 transition-colors hover:text-white hover:underline hover:underline-offset-4';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-night text-white">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-purple to-brand-blue" />
      <div className="mx-auto max-w-7xl px-6 pb-7 pt-12 lg:px-10">
        <div className="grid items-center gap-8 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Seu próximo jogo começa com uma descoberta</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Menos busca.<br /><span className="text-violet-300">Mais gameplay.</span></h2>
            <a href="#/busca" className="mt-6 inline-flex items-center gap-4 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-night transition-colors hover:bg-violet-100">Explorar jogos <span aria-hidden="true">↗</span></a>
          </div>
          <img src="/brand/saveme-reference.png" alt="" width="1344" height="576" loading="lazy" className="w-full rounded-xl border border-white/10" />
        </div>
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-16">
          <div>
            <Brand inverted />
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">Mais tempo jogando. Menos tempo pesquisando.<br />Um caminho mais simples para encontrar jogos e descobrir oportunidades.</p>
          </div>
          <nav aria-label="Explorar no rodapé" className="flex flex-col gap-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Explorar</h3>
            <a href="#/" className={linkStyle}>Início</a>
            <a href="#/busca" className={linkStyle}>Buscar jogos</a>
            <a href="#/comparacao" className={linkStyle}>Comparar preços</a>
          </nav>
          <nav aria-label="Sua conta no rodapé" className="flex flex-col gap-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Sua conta</h3>
            <a href="#/login" className={linkStyle}>Entrar</a>
            <a href="#/cadastro" className={linkStyle}>Criar conta</a>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-slate-400 sm:flex-row sm:gap-8">
          <p>© {new Date().getFullYear()} SaveMe Games.</p>
          <p className="max-w-lg sm:text-right">SaveMe Games não vende jogos. Preços e disponibilidade devem ser confirmados na loja de origem.</p>
        </div>
      </div>
    </footer>
  );
}
