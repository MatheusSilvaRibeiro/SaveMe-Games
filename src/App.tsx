import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { Busca } from './pages/Busca';
import { Comparacao } from './pages/Comparacao';

const pages = {
  '/': Home,
  '/login': Login,
  '/cadastro': Cadastro,
  '/busca': Busca,
  '/comparacao': Comparacao,
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

  const Page = Object.hasOwn(pages, path) ? pages[path as keyof typeof pages] : null;

  return (
    <>
      <Header currentPath={path} />
      <main>
        {Page ? <Page /> : <><h1>Página não encontrada</h1><a href="#/">Voltar ao início</a></>}
      </main>
      <Footer />
    </>
  );
}
