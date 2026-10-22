# SaveMe Games

Base da página web em React + TypeScript + Vite + Tailwind CSS 4.

```powershell
npm run setup
npm run dev
```

Requer Node.js 22 e npm. O setup instala dependências do site e da API. O comando dev compila e inicia a API, aguarda sua resposta e então inicia o site. Acesse http://127.0.0.1:5173/#/busca. Mantenha o terminal aberto; Ctrl+C encerra os dois serviços.

- `src/App.tsx`: estrutura compartilhada e seleção das páginas por hash.
- `src/components/`: Header, Footer e assinatura textual compartilhada.
- `src/styles/global.css`: estilos.
- `npm run build`: compilar a página.

Tokens da marca são definidos no `@theme` de `src/styles/global.css`.

## Busca Steam integrada

Na primeira execução, use `npm run setup`. Depois, `npm run dev` inicia site e API juntos. Para trabalhar com terminais separados, use `npm run dev:api` e `npm run dev:web`. Não execute os dois modos ao mesmo tempo nas mesmas portas.

Acesse http://127.0.0.1:5173/#/busca. A busca é enviada ao clicar em Buscar ou pressionar Enter. Selecione um resultado para consultar o preço e abrir a página na Steam. Resultados podem incluir complementos e trilhas sonoras; não há comparação entre lojas nesta etapa.

O proxy `/api` do Vite é apenas para desenvolvimento. Para publicação, configure `VITE_API_BASE_URL` antes do build ou encaminhe `/api` no servidor. O backend escuta somente no computador local. Cadastro e login usam PostgreSQL 17, Prisma e JWT; consulte [a configuração do banco e pgAdmin 4](backend/README.md#banco-e-autenticação) antes de usar as contas.

### Verificação

- `npm run build`: tipos e compilação do site.
- `node --test tools/dev.test.mjs`: verifica o início conjunto e o proxy em portas alternativas 3101/5174, sem consultar a Steam.
- `npm test --prefix backend`: testes HTTP da API com fonte simulada.
- `node --test tools/steam/steam-probe.test.mjs tools/steam/steam-search.test.mjs tools/steam/steam-catalog.test.mjs tools/steam/steam-featured.test.mjs`: testes dos adaptadores.
- `npm run test:e2e`: testes de interface com Playwright e Microsoft Edge instalado. Os servidores são iniciados automaticamente se não estiverem rodando.
- No PowerShell, `$env:STEAM_LIVE_TEST='1'; npm run test:e2e -- --grep '@live'` habilita uma verificação externa opcional. Remova a variável ao terminar com `Remove-Item Env:STEAM_LIVE_TEST`.

Os testes padrão simulam respostas da Steam para verificar também falhas. O teste `@live` consulta a fonte real e pode falhar por indisponibilidade externa. Nenhum deles comprova a meta mensal de disponibilidade.

A busca inicia com destaques reais da Steam: mais vendidos, ofertas e novidades. São 12 títulos por página, com botão para carregar mais. A pesquisa por nome continua independente desses destaques. Filtros de gênero e preço se aplicam apenas aos títulos carregados, não ao catálogo inteiro da Steam. Jogos gratuitos são confirmados nos detalhes; preço ausente permanece sob consulta. A seleção e a busca reutilizam dados públicos em cache por até cinco minutos, preservando o horário original da consulta no popup.

## Solução de problemas locais

- `ECONNREFUSED 127.0.0.1:3000`: o site está aberto, mas a API não está respondendo. Na raiz atualizada, use `npm run dev` para iniciar ambos. No modo separado, mantenha também `npm run dev:api` aberto.
- Dependências incompletas: execute `npm run setup` na raiz. Instalar só as dependências do site não prepara o backend.
- Porta ocupada: encerre os servidores antigos antes de iniciar o modo conjunto.
- API acessível, mas Steam indisponível: confira a mensagem da consulta. `GET /api/health` verifica nossa API, sem garantir a disponibilidade da Steam.
