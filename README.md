# SaveMe Games

Base da página web em React + TypeScript + Vite + Tailwind CSS 4.

```powershell
npm run setup
npm run dev
```

Requer Node.js 22.12+ e npm. O setup instala dependências do site e da API. O comando dev compila e inicia a API, aguarda sua resposta e então inicia o site. Acesse http://127.0.0.1:5173/#/busca. Mantenha o terminal aberto; Ctrl+C encerra os dois serviços.

- `src/App.tsx`: estrutura compartilhada e seleção das páginas por hash.
- `src/components/`: Header, Footer e assinatura textual compartilhada.
- `src/styles/global.css`: estilos.
- `npm run build`: compilar a página.

Tokens da marca são definidos no `@theme` de `src/styles/global.css`.

## Catálogo de jogos e comparação

Na primeira execução, use `npm run setup`. Depois, `npm run dev` inicia site e API juntos. Para trabalhar com terminais separados, use `npm run dev:api` e `npm run dev:web`. Não execute os dois modos ao mesmo tempo nas mesmas portas.

Acesse http://127.0.0.1:5173/#/busca. A busca é enviada ao clicar em Buscar ou pressionar Enter. Selecione um resultado para consultar o preço e abrir a página na Steam. Resultados da Steam podem incluir complementos e trilhas sonoras. A Epic tem uma seção própria para jogos de PC no Brasil. Os botões de loja navegam entre as seções e os filtros de gênero e preço se aplicam aos resultados carregados.

Em desenvolvimento, o Vite encaminha `/api` à API local. Em produção, use o build de mesma origem descrito abaixo. Cadastro e login usam PostgreSQL 17, Prisma e JWT. Consulte [a configuração do banco e pgAdmin 4](backend/README.md#banco-e-autenticação) antes de usar as contas.

### Comparação de preços

Acesse `http://127.0.0.1:5173/#/comparacao` e selecione um jogo. Esta versão compara Hades, Hades II, Celeste, Dead Cells e Among Us (jogos base para PC). Nos títulos associados, a busca também oferece o link de comparação: nos detalhes Steam e nos cards Epic.

A API consulta as integrações existentes, ordena as ofertas por preço e informa economia ou empate somente quando as duas lojas têm valores válidos em BRL. Falhas e preços ausentes geram um resultado parcial. A fonte dos dados Epic é a EGData, serviço de terceiros; o horário da consulta e a data do registro de preço na fonte são apresentados separadamente. Confirme preço e condições na loja.

O PostgreSQL fornece as associações consultadas pela página e pela rota da extensão `GET /api/comparisons/steam/:appId`. O arquivo `data/game-associations.json` alimenta a carga inicial dos cinco jogos. Comparações consultam as lojas e gravam observações em PostgreSQL. Se o banco estiver indisponível, a API de comparação retorna `503 CATALOG_UNAVAILABLE`.

A cobertura é limitada às associações cadastradas. Não há correspondência automática por semelhança de nome, pois isso pode misturar jogos, edições, DLCs e versões para celular.

Com sessão ativa, use **Favoritar** na comparação e **Favoritos** na navegação para consultar ou remover jogos salvos. **Avisos** reúne quedas de preço detectadas nas consultas, com indicação de itens não lidos. A frequência depende das coletas. Consulte as [regras e os testes dos avisos](backend/README.md#avisos-de-queda-de-preço).

### Coleta e histórico de preços

A comparação mostra as observações registradas por loja no horário de Brasília. O gráfico usa pontos para preços conhecidos e mantém as lacunas. Além das consultas feitas na comparação, a hospedagem pode agendar uma execução independente:

```sh
npm run prices:collect
```

Use o artefato compilado, com as migrations e a carga já aplicadas, e injete `DATABASE_URL` na tarefa agendada. Um ponto de partida é uma execução a cada seis horas (`0 */6 * * *` em UTC, se a plataforma usar cron). Configure tempo máximo de execução de pelo menos cinco minutos e retenha os logs. A API web e o navegador não disparam a tarefa. Consulte [os parâmetros, códigos de saída e testes](backend/README.md#coleta-e-histórico-de-preços).

Para habilitar a comparação localmente, configure `DATABASE_URL` para o seu PostgreSQL de desenvolvimento e execute na raiz:

```sh
npm run build:production
npm run db:migrate
npm run db:seed:catalog
```

Depois, inicie com `npm run dev` ou `npm run start:production`. A carga pode ser repetida e grava apenas jogos, lojas e ofertas.

### Verificação

- `npm run build`: tipos e compilação do site.
- `node --test tools/dev.test.mjs`: verifica o início conjunto e o proxy em portas alternativas 3101/5174, sem consultar a Steam.
- `npm test --prefix backend`: testes HTTP da API com fonte simulada.
- `node --test tools/steam/steam-probe.test.mjs tools/steam/steam-search.test.mjs tools/steam/steam-catalog.test.mjs tools/steam/steam-featured.test.mjs`: testes dos adaptadores.
- `npm run test:e2e -- e2e/comparison.spec.ts`: testa a página de comparação, navegação, empate, gratuidade e falhas com dados simulados.
- `npm run test:e2e`: testes de interface com Playwright e Microsoft Edge instalado. Os servidores são iniciados automaticamente se não estiverem rodando.
- No PowerShell, `$env:STEAM_LIVE_TEST='1'; npm run test:e2e -- --grep '@live'` habilita uma verificação externa opcional. Remova a variável ao terminar com `Remove-Item Env:STEAM_LIVE_TEST`.

Os testes padrão simulam respostas da Steam para verificar também falhas. O teste `@live` consulta a fonte real e pode falhar por indisponibilidade externa. Nenhum deles comprova a meta mensal de disponibilidade.

A busca inicia com destaques reais da Steam: mais vendidos, ofertas e novidades. São 12 títulos por página, com botão para carregar mais. A pesquisa por nome continua independente desses destaques. Filtros de gênero e preço se aplicam apenas aos títulos carregados, não ao catálogo inteiro da Steam. Jogos gratuitos são confirmados nos detalhes; preço ausente permanece sob consulta. A seleção e a busca reutilizam dados públicos em cache por até cinco minutos, preservando o horário original da consulta no popup.

## Solução de problemas locais

- `ECONNREFUSED 127.0.0.1:3000`: o site está aberto, mas a API não está respondendo. Na raiz atualizada, use `npm run dev` para iniciar ambos. No modo separado, mantenha também `npm run dev:api` aberto.
- Dependências incompletas: execute `npm run setup` na raiz. Instalar só as dependências do site não prepara o backend.
- Porta ocupada: encerre os servidores antigos antes de iniciar o modo conjunto.
- API acessível, mas Steam indisponível: confira a mensagem da consulta. `GET /api/health` verifica nossa API, sem garantir a disponibilidade da Steam.

## Execução de produção e preparação para nuvem

A mesma API serve o site compilado e `/api`, sem Vite ou proxy de desenvolvimento. O roteamento web usa hash. `build:production` fixa a URL da API em `/api`.

### Hospedagem com build nativo de Node.js

Use a raiz do repositório como diretório de trabalho. Configure Node.js 22.12 ou posterior na série 22. O build usa os lockfiles da raiz e do backend via `npm ci`. O comando `setup` inclui as dependências de desenvolvimento necessárias à compilação e ao Prisma mesmo com `NODE_ENV=production`.

Comando de build:

```sh
npm run setup && npm run build:production
```

Comando de inicialização:

```sh
npm run start:production
```

Se a hospedagem separar build e execução, preserve estes caminhos no artefato, com a mesma estrutura de diretórios:

| Caminho | Uso |
|---|---|
| `package.json` e `tools/start-production.mjs` | Comando de inicialização. |
| `backend/dist/` e `backend/package.json` | API compilada, adaptadores e tipo de módulo Node. |
| `backend/public/` | HTML, JavaScript, CSS e arquivos estáticos do site. |
| `backend/node_modules/` | Dependências da API e Prisma Client gerado. Preserve também a CLI Prisma se a tarefa de migration usar o mesmo artefato. |
| `data/game-associations.json` | Dados da carga inicial dos cinco jogos. |
| `backend/prisma.config.ts` e `backend/prisma/` | Configuração, schema e migrations para a tarefa de release. |

Gere as dependências na plataforma de destino, pois alguns pacotes usam componentes específicos do sistema operacional. Injete os segredos no ambiente de execução pelo provedor escolhido. Exclua arquivos `.env` do artefato.

### Teste de produção local

Execute na raiz:

```powershell
npm run setup
npm run build:production
npm run test:production
$env:API_HOST='127.0.0.1'
npm run start:production
```

Abra `http://127.0.0.1:3000/#/comparacao` usando a porta configurada. Para testar autenticação por HTTP local, inclua a origem `http://127.0.0.1:3000` em `AUTH_ORIGINS` e use `COOKIE_SECURE=false`.

### Configuração da hospedagem

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL; use TLS conforme o provedor. Nunca versione credenciais. |
| `JWT_SECRET` | Segredo aleatório de pelo menos 32 caracteres. |
| `AUTH_ORIGINS` | Origens HTTPS exatas, separadas por vírgula, sem caminho nem barra final. Inclua a origem pública para permitir as operações de conta que verificam o cabeçalho `Origin`. |
| `COOKIE_SECURE` | `true` na publicação HTTPS; `false` somente no teste HTTP local. |
| `PORT` | Porta fornecida pela plataforma; tem prioridade sobre `API_PORT` (padrão 3000). |
| `API_HOST` | `0.0.0.0` em produção; início local da API mantém `127.0.0.1`. |
| `TRUST_PROXY_HOPS` | Padrão `0`. Ajuste somente ao número conhecido de proxies confiáveis, impedindo acesso direto que permita forjar IPs. |

O comando de produção define `NODE_ENV=production`, `API_HOST=0.0.0.0` e `SERVE_WEB=true` quando ausentes. Termine o TLS no provedor ou proxy e encaminhe a aplicação inteira, incluindo `/api`, pela mesma origem HTTPS. O cookie de sessão `saveme_session_api` é `HttpOnly`, usa `SameSite=Lax` e tem escopo `/api`. Habilite `COOKIE_SECURE=true` para limitar seu envio a HTTPS.

Mantenha `TRUST_PROXY_HOPS=0` se a cadeia de proxies for desconhecida. Se habilitar a confiança por quantidade de saltos, garanta que todos os caminhos tenham a mesma quantidade de proxies confiáveis, bloqueie o acesso direto ao processo e faça o proxy de borda controlar os cabeçalhos `X-Forwarded-*`. Valide o IP usado pelo limitador de cadastro e login antes de abrir tráfego público.

### Migrations e verificação do release

Antes de liberar uma versão que altera o banco, faça backup, configure `DATABASE_URL` para o banco de destino e execute na raiz, como tarefa única do release:

```sh
npm run db:migrate
npm run db:seed:catalog
```

A migration e a carga exigem uma URL explícita. O build gera o Prisma Client sem conexão com o banco. Execute a carga após instalar a migration do catálogo. A inicialização da aplicação é independente dessas tarefas.

Valide `/api/health`, página inicial, lista `/api/comparisons/games`, cadastro, login, recarga e logout pela URL HTTPS. O health confirma somente o processo; contas exigem banco real e consultas exigem fontes externas. O teste de produção local não comprova esses serviços nem HTTPS.

Mantenha a imagem/commit anterior para rollback da aplicação. Não reverta migrations automaticamente: restauração e compatibilidade dos dados devem ser avaliadas antes. Provedor, domínio, backup/restauração e validação com PostgreSQL ainda precisam ser definidos e executados; este preparo não significa que a aplicação já esteja publicada.

### Empacotamento alternativo por Docker

Na raiz, construa com `docker build -t saveme-games .`. O Dockerfile inclui site, API, catálogo e Prisma. Injete as variáveis no contêiner. A porta interna padrão é 3000 e a plataforma pode fornecer `PORT`. Para tarefas de release com a imagem, use `npm run db:migrate --prefix backend` e depois `npm run db:seed:catalog --prefix backend`, com `DATABASE_URL` no ambiente.

**Validação Docker pendente:** o daemon local está indisponível. O roteiro de hospedagem nativa acima é independente dessa validação.

## Primeiro acesso ao servidor publicado

A hospedagem gratuita pode suspender a API quando fica sem uso. A interface verifica `/api/health` antes das consultas, compartilha essa espera entre telas e mostra um aviso se a inicializacao demorar. O limite de espera e de 90 segundos; depois disso o usuario pode tentar novamente. Apenas a verificacao de saude admite repeticao para erros temporarios. Cadastro, login e outras escritas nao sao reenviados automaticamente. A verificacao confirma o processo da API, nao a disponibilidade do banco ou das lojas. O acesso oficial do site e https://saveme-games.vercel.app; o dominio da Render e o backend.

### Agendamento da coleta em nuvem

O workflow `.github/workflows/collect-prices.yml` executa a coleta de precos reais quatro vezes ao dia (00:17, 06:17, 12:17 e 18:17 UTC) e admite inicio manual em Actions. Configure `SAVEME_DATABASE_URL` nos secrets de Actions com a conexao PostgreSQL do ambiente desejado. Ela nao deve ser uma variavel VITE nem ser versionada. A tarefa compila somente o backend, nao aplica migrations, nao faz seed e nao depende de acesso ao site. Os locks existentes impedem sobreposicao no banco. Falhas totais ou parciais deixam o job com erro para investigacao.

O agendamento do GitHub nao garante minuto exato e pode atrasar. Em repositorios publicos sem atividade ele pode ser desabilitado pela plataforma; confira o estado em Actions. A evidencia da entrega deve incluir o link da execucao e os totais coletados. Historico registra somente consultas realizadas, sem dados antigos fabricados.

## Extensao Chrome e Edge

A pasta `extension/` e uma extensao Manifest V3, independente do servidor local. Para instalar: abra `chrome://extensions` ou `edge://extensions`, ative o modo do desenvolvedor e use **Carregar sem compactacao** selecionando essa pasta. Ao atualizar os arquivos, recarregue a extensao e a pagina da loja. Nao e necessario entrar na conta para consultar precos publicos.

Ao abrir `https://store.steampowered.com/app/1145360/Hades/`, o painel usa o AppID da URL para consultar a comparacao publicada. Um jogo sem associacao pode apresentar somente sua oferta Steam, com essa limitacao explicita. Nas buscas Google, o usuario clica em Consultar ofertas; nenhuma pesquisa e enviada ao SaveMe antes desse clique. Titulos ambiguos nao sao escolhidos pelo primeiro resultado. Erros da API nao sao apresentados como uma comparacao bem-sucedida.

A configuracao publica esta em `extension/config.js`; o manifesto permite somente consultas a https://saveme-games.vercel.app. A extensao nao recebe credenciais do banco. Testes do worker: `node --test extension/prices.test.cjs`. A instalacao para desenvolvimento nao equivale a publicacao nas lojas Chrome/Edge.
