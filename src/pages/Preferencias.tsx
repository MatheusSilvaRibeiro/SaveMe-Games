import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSessionReady, useUser } from '../services/auth';
import { preferences } from '../services/preferences';

function AccountPreferences() {
  const [value, setValue] = useState<boolean>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const write = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController(); setValue(undefined); setError('');
    void preferences(controller.signal).then(data => { if (!controller.signal.aborted) setValue(data.priceAlertsEnabled); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { controller.abort(); write.current?.abort(); };
  }, [retry]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (value === undefined || pending) return;
    const controller = new AbortController(); write.current = controller;
    setPending(true); setError(''); setSaved(false);
    try { await preferences(controller.signal, value); if (!controller.signal.aborted) setSaved(true); }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao salvar.'); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  return <>
    {error && <p role="alert">{error}</p>}
    {value === undefined ? error ? <button onClick={() => setRetry(x => x + 1)}>Tentar novamente</button> : <p role="status">Carregando prefer&#234;ncias...</p>
      : <form onSubmit={save} className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <label className="flex items-start gap-3"><input type="checkbox" checked={value} onChange={event => { setValue(event.target.checked); setSaved(false); }} className="mt-1 size-5" />
          <span>Receber avisos de queda de pre&#231;o no site</span></label>
        <p className="mt-4 text-sm">Acompanha os favoritos com ofertas cadastradas para coleta. Desativar impede novos avisos; os anteriores continuam dispon&#237;veis. Reativar n&#227;o envia avisos retroativos. A verifica&#231;&#227;o ocorre a cada coleta, sem garantia de envio imediato.</p>
        <button disabled={pending} className="rounded-lg bg-brand-purple px-5 py-3 text-white disabled:opacity-50">{pending ? 'Salvando...' : <>Salvar prefer&#234;ncias</>}</button>
        {saved && <p role="status" className="mt-4 !mb-0">Prefer&#234;ncias salvas.</p>}
      </form>}
  </>;
}
export function Preferencias() {
  const user = useUser(), ready = useSessionReady();
  return <><h1>Prefer&#234;ncias de avisos</h1><p>Controle os avisos de queda de pre&#231;o da sua conta.</p>
    {!ready ? <p role="status">Verificando sua sess&#227;o...</p> : user ? <AccountPreferences key={user.id} />
      : <p>Entre na sua conta para configurar os avisos. <a href="#/login">Ir para o login</a></p>}
  </>;
}
