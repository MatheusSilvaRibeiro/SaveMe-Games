import { useState, type FormEvent } from 'react';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-cloud px-4 py-3 text-base transition-colors placeholder:text-slate-400 focus:border-brand-purple focus:bg-white';

function PasswordField({ id, label, confirm = false }: { id: string; label: string; confirm?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={visible ? 'text' : 'password'} required minLength={8} autoComplete={id === 'login-password' ? 'current-password' : 'new-password'} aria-describedby={confirm ? undefined : `${id}-hint`} className={`${inputClass} pr-24`} />
        <button type="button" aria-controls={id} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-1 right-1 rounded-lg px-3 text-sm font-semibold text-brand-purple hover:bg-violet-50">{visible ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {!confirm && <p id={`${id}-hint`} className="mt-2 !mb-0 text-xs !leading-5">Use pelo menos 8 caracteres.</p>}
    </div>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'cadastro' }) {
  const signup = mode === 'cadastro';
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const data = new FormData(event.currentTarget);
    if (signup && !String(data.get('name') ?? '').trim()) {
      setError('Informe seu nome.');
      event.currentTarget.querySelector<HTMLInputElement>('#name')?.focus();
      return;
    }
    if (signup && data.get('signup-password') !== data.get('confirm-password')) {
      setError('As senhas não coincidem. Confira a confirmação da senha.');
      event.currentTarget.querySelector<HTMLInputElement>('#confirm-password')?.focus();
      return;
    }
    setNotice(signup
      ? 'Os dados foram validados. A criação da conta estará disponível quando a integração com o servidor for concluída. Nenhuma conta foi criada.'
      : 'Os campos foram validados. O acesso à conta estará disponível quando a integração com o servidor for concluída.');
  }

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 lg:grid-cols-2">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-brand-purple p-8 text-white sm:p-10 lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border-[48px] border-white/5" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">SAVEME GAMES</span>
          <h2 className="mt-8 max-w-sm font-display text-3xl font-semibold leading-tight sm:text-4xl">Menos busca.<br />Mais gameplay.</h2>
          <p className="mt-5 !mb-0 !text-violet-100">Seu próximo jogo começa com uma boa descoberta. Encontre os títulos que você quer jogar em um só lugar.</p>
        </div>
        <div className="relative mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 lg:mt-16">
          <svg aria-hidden="true" className="mb-4 size-8 text-violet-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="4" /><path d="M7 12h4M9 10v4M16 11h.01M18 13h.01" /></svg>
          <h3 className="font-display font-semibold">Mais tempo para o que você gosta.</h3>
          <p className="mt-2 !mb-0 text-sm !leading-6 !text-violet-100">Explore a busca de jogos enquanto preparamos os próximos passos da sua experiência.</p>
          <a href="#/busca" className="mt-4 inline-flex items-center gap-2 text-sm !text-white">Explorar jogos <span aria-hidden="true">→</span></a>
        </div>
      </aside>

      <section aria-labelledby="auth-title" className="p-6 sm:p-10 lg:p-12">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-purple">{signup ? 'Comece por aqui' : 'Boas-vindas de volta'}</span>
        <h1 id="auth-title" className="mt-3 !mb-3 !text-3xl">{signup ? 'Crie sua conta' : 'Entre na sua conta'}</h1>
        <p className="!mb-7 text-sm">{signup ? 'Preencha seus dados para começar sua jornada no SaveMe Games.' : 'Informe seu e-mail e sua senha para continuar.'}</p>

        <form onSubmit={submit} onChange={() => { setError(''); setNotice(''); }} className="space-y-5">
          {signup && <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold">Nome</label>
            <input id="name" name="name" autoComplete="name" required maxLength={100} placeholder="Como podemos chamar você?" className={inputClass} />
          </div>}
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" className={inputClass} />
          </div>
          <PasswordField id={signup ? 'signup-password' : 'login-password'} label="Senha" />
          {signup && <PasswordField id="confirm-password" label="Confirmar senha" confirm />}

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">{notice}</div>}

          <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand-purple px-5 py-3.5 font-semibold text-white transition-colors hover:bg-violet-900">{signup ? 'Criar conta' : 'Entrar'} <span aria-hidden="true">→</span></button>
          <p className="!mb-0 text-center text-xs !leading-5">Em desenvolvimento: {signup ? 'o cadastro' : 'o login'} ainda não está conectado ao servidor.</p>
        </form>

        <div className="mt-7 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
          {signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
          <a href={signup ? '#/login' : '#/cadastro'}>{signup ? 'Entrar' : 'Criar conta'}</a>
        </div>
      </section>
    </div>
  );
}
