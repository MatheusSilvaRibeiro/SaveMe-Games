import { useSyncExternalStore } from 'react';
import { apiState, subscribeApi } from '../services/api-ready';

export function ApiStatus() {
  const state = useSyncExternalStore(subscribeApi, apiState);
  if (state === 'idle') return null;
  return <div role={state === 'error' ? 'alert' : 'status'} className="border-b border-violet-200 bg-violet-50 px-6 py-3 text-center text-sm text-violet-950">
    {state === 'starting' ? <>Iniciando o servidor. O primeiro acesso pode levar cerca de um minuto. Aguarde sem reenviar o formul&#225;rio.</>
      : <>O servidor n&#227;o respondeu. <button type="button" onClick={() => window.location.reload()} className="ml-2 font-semibold underline">Tentar novamente</button></>}
  </div>;
}
