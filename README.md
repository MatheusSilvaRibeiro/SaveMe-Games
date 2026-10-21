# SaveMe Games

Base da página web em React + TypeScript + Vite + Tailwind CSS 4.

```sh
npm install
npm run dev
```

Requer Node.js 22 e npm. Acesse http://localhost:5173.

- `src/App.tsx`: estrutura compartilhada e seleção das páginas por hash.
- `src/components/`: Header, Footer e assinatura textual compartilhada.
- `src/styles/global.css`: estilos.
- `npm run build`: compilar a página.

Documentos do projeto em `.codex/`. As funcionalidades do MVP serão desenvolvidas nesta base.

A proposta visual do Header e Footer e suas referências estão em [docs/identidade-interface.md](docs/identidade-interface.md). Tokens da marca são definidos no `@theme` de `src/styles/global.css`.

## Busca Steam integrada

Na raiz, execute `npm install` e `npm run dev`. Em outro terminal, execute `npm ci --prefix backend` e `npm run dev --prefix backend`.

Acesse http://127.0.0.1:5173/#/busca. A busca é enviada ao clicar em Buscar ou pressionar Enter. Selecione um resultado para consultar o preço e abrir a página na Steam. Resultados podem incluir complementos e trilhas sonoras; não há comparação entre lojas nesta etapa.

O proxy `/api` do Vite é apenas para desenvolvimento. Para publicação, configure `VITE_API_BASE_URL` antes do build ou encaminhe `/api` no servidor. O backend nesta etapa escuta somente no computador local e ainda não usa banco ou autenticação.

### Verificação

- `npm run build`: tipos e compilação do site.
- `npm test --prefix backend`: testes HTTP da API com fonte simulada.
- `node --test tools/steam/steam-probe.test.mjs tools/steam/steam-search.test.mjs`: testes dos adaptadores.
- `npm run test:e2e`: testes de interface com Playwright e Microsoft Edge instalado. Os servidores são iniciados automaticamente se não estiverem rodando.
- No PowerShell, `$env:STEAM_LIVE_TEST='1'; npm run test:e2e -- --grep '@live'` habilita uma verificação externa opcional. Remova a variável ao terminar com `Remove-Item Env:STEAM_LIVE_TEST`.

Os testes padrão simulam respostas da Steam para verificar também falhas. O teste `@live` consulta a fonte real e pode falhar por indisponibilidade externa. Nenhum deles comprova a meta mensal de disponibilidade.
