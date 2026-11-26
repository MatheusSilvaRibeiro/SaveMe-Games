import { useState, type FormEvent } from 'react';
import { waitForApi } from '../services/api-ready';
const inputClass = 'w-full rounded-xl border border-slate-300 px-4 py-3';
export function RecuperarSenha() { return <RecoveryForm reset={false} />; }
export function RedefinirSenha() { return <RecoveryForm reset />; }
function RecoveryForm({ reset }: { reset: boolean }) {
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const token = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('token') ?? '';
  const valid = !reset || /^[a-f0-9]{64}$/.test(token);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const data = new FormData(event.currentTarget); setError('');
    if (reset && data.get('password') !== data.get('confirmation')) { setError('As senhas n\u00e3o coincidem.'); return; }
    setPending(true);
    try {
      await waitForApi();
      const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${base}/auth/${reset ? 'reset-password' : 'forgot-password'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify(reset ? { token, password: data.get('password') } : { email: data.get('email') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'N\u00e3o foi poss\u00edvel concluir. Tente novamente.');
      setMessage(result.message);
      if (reset) history.replaceState(null, '', `${location.pathname}${location.search}#/redefinir-senha`);
    } catch (cause) { setError(cause instanceof Error && cause.name === 'Error' ? cause.message : 'Falha de conex\u00e3o. Tente novamente em instantes.'); }
    finally { setPending(false); }
  }
  return <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10">
    <h1>{reset ? 'Definir nova senha' : 'Recuperar senha'}</h1>
    <p>{reset ? 'Escolha uma senha de 8 a 128 caracteres. Suas outras sess\u00f5es ser\u00e3o encerradas.' : 'Informe o e-mail da sua conta. O link de recupera\u00e7\u00e3o vale por 15 minutos.'}</p>
    {!valid && !message && <p role="alert">Link inv&aacute;lido. <a href="#/recuperar-senha">Solicitar outro link</a></p>}
    {message ? <div role="status"><p>{message}</p><a href="#/login">Voltar para entrar</a></div> : valid && <form onSubmit={submit} aria-busy={pending} className="space-y-5">
      {reset ? <>
        <label className="block">Nova senha<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
        <label className="block">Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
      </> : <label className="block">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></label>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-brand-purple px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? 'Aguarde...' : reset ? 'Salvar nova senha' : 'Enviar link'}</button>
    </form>}
    {!message && <a href="#/login" className="mt-6 inline-block">Voltar para entrar</a>}
  </section>;
}
