// Assinatura tipográfica provisória; não redesenha o símbolo do Brand Book.
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <a href="#/" aria-label="SaveMe Games — início" className="inline-flex shrink-0 flex-col gap-1 rounded-sm">
      <span className={`font-display text-2xl font-bold leading-none tracking-tight ${inverted ? 'text-white' : 'text-night'}`}>
        Save<span className={inverted ? 'text-violet-300' : 'text-brand-purple'}>Me</span>
      </span>
      <span className={`text-[9px] font-semibold tracking-[0.48em] ${inverted ? 'text-slate-400' : 'text-slate-500'}`}>GAMES</span>
    </a>
  );
}
