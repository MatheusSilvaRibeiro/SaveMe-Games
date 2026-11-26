import { ApiStatus } from './components/ApiStatus';
import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { Busca } from './pages/Busca';
import { Comparacao } from './pages/Comparacao';
import { Favoritos } from './pages/Favoritos';
import { Avisos } from './pages/Avisos';

const pages = {
  '/': Home,
  '/login': Login,
  '/cadastro': Cadastro,
  '/busca': Busca,
  '/comparacao': Comparacao,
  '/favoritos': Favoritos,
  '/avisos': Avisos,
};

function getPath() {
  return window.location.hash.slice(1) || '/';
}

export function App() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setPath(getPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [pathname = '/'] = path.split('?', 1);
  const route = pathname.startsWith('/comparacao/') ? '/comparacao' : pathname;
  const Page = Object.hasOwn(pages, route) ? pages[route as keyof typeof pages] : null;

  return (
    <>
      <Header currentPath={route} />
      <ApiStatus />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 outline-none lg:px-10 lg:py-24">
        {Page ? <Page key={path} /> : <><h1>Página não encontrada</h1><a href="#/">Voltar ao início</a></>}
      </main>
      <Footer />
    </>
  );
}
