# API SaveMe em desenvolvimento

API NestJS para busca Steam e autenticação por e-mail/senha com PostgreSQL 17, Prisma e JWT.

Na pasta `backend`, com Node.js 22.12+ ou 24:

```powershell
npm ci
npm run prisma:generate
npm run dev
```

`npm run dev` compila e inicia; reinicie após editar. `npm test` compila e executa testes HTTP com a Steam simulada.

Rotas locais:

- `GET /api/comparisons/games`: associações disponíveis para comparação, com ID interno, edição e identificadores das lojas.
- `GET /api/comparisons/:gameId`: compara as ofertas do jogo associado (por exemplo, `celeste`). Retorna `jogo`, `ofertas`, `situacao`, `menorPrecoCentavos`, `lojasMenorPreco` e `economiaCentavos`. Quando a consulta é parcial ou não há preços, os valores de menor preço e economia são `null`. IDs sem associação retornam 404; IDs inválidos retornam 400. A rota é pública e não usa autenticação ou banco.
- `GET /api/epic/games?q=Celeste&page=1`: busca Epic via EGData. Sem `q`, lista ofertas de PC com preço e página disponíveis para o Brasil.
- `GET /api/epic/games/:offerId`: detalhes e preço regional Epic via EGData.

- `GET /api/health`: saúde da API, sem verificar Steam ou banco.
- `GET /api/steam/featured`: destaques da Steam em páginas de 12 títulos. Use `?page=2` para continuar; `proximaPagina` indica a próxima página disponível. A fonte combina mais vendidos, ofertas e novidades, sem duplicatas.
- `GET /api/steam/games?q=Portal%202`: resultados para seleção, incluindo possíveis DLCs e trilhas sonoras.
- `GET /api/steam/games/620`: detalhes e preço em BRL quando disponível.

Porta padrão 3000; configure `API_PORT` no ambiente se precisar. O processo escuta apenas em 127.0.0.1 nesta etapa.

Erros: 400 entrada inválida, 404 produto indisponível na consulta, 502 resposta externa inválida/HTTP de falha, 503 falha de conexão, 504 tempo esgotado. Preço ausente é null; gratuito é zero com indicação da fonte.

Os endpoints `featuredcategories`, `storesearch` e `appdetails` são da loja Steam e foram testados experimentalmente. Não há garantia de estabilidade ou cobertura estabelecida por esta investigação. Limites e condições de uso ainda precisam ser avaliados. Há cache público em memória por cinco minutos (até 100 entradas), compartilhamento de consultas simultâneas e limite de três consultas externas de detalhes em andamento. Os detalhes usam timeout de 2,5 segundos; falhas preservam os dados básicos da busca sem inventar gratuidade ou gênero. A busca enriquece até 12 resultados. Os preços não são persistidos e a meta de disponibilidade ainda não foi comprovada. O horário retornado indica nossa consulta, não a data de alteração do preço na loja.

## Associações e comparação

`src/comparison/catalog.ts` implementa `GameAssociationRepository` lendo `data/game-associations.json` na raiz do repositório. O catálogo inicial inclui Hades, Hades II, Celeste, Dead Cells e Among Us para PC. Essas associações preservam os exemplos da feature; a expansão automática do catálogo será implementada no backend. Preserve a pasta `data` junto ao projeto ao publicar a API; ela não é gerada pelo build TypeScript. A associação é conferida por identificadores, namespace e edição; não usa correspondência aproximada de títulos. Para migrar ao PostgreSQL, implemente o mesmo contrato e substitua o repositório na criação do serviço em `app.ts`.

`src/comparison/service.ts` consulta as duas lojas em paralelo e valida identidade, tipo de conteúdo, região e moeda. Menor preço e economia exigem duas ofertas válidas. Empate mantém as duas lojas como menor preço; falhas de uma fonte preservam a outra oferta, sem declarar vencedora. Preço ausente é `null`; zero válido representa gratuidade na oferta. Descontos usam o preço original da própria loja.

O resultado completo é mantido em cache por 60 segundos; resultados parciais, por 10 segundos. As integrações podem reutilizar preços por até cinco minutos. Consultas simultâneas ao mesmo jogo são compartilhadas e os horários originais são preservados. Os testes de comparação fazem parte de `npm test` e não precisam de PostgreSQL.

## Banco e autenticação

1. No pgAdmin 4, conecte ao PostgreSQL 17 usando host `127.0.0.1`, porta `5432` e seu usuário PostgreSQL. A senha mestra do pgAdmin é independente da senha do PostgreSQL.
2. Crie o banco `saveme_games` se ele ainda não existir.
3. Copie `.env.example` para `.env` nesta pasta e preencha `DATABASE_URL` e um `JWT_SECRET` aleatório. A senha na URL deve ter os caracteres especiais codificados. O arquivo `.env` é ignorado pelo Git.
4. Execute `npm run db:migrate`. A migração versionada cria as tabelas `users` e `sessions` sem apagar registros.
5. Inicie o projeto com `npm run dev` na raiz. Cadastre-se em `http://127.0.0.1:5173/#/cadastro`; o sucesso inicia uma sessão e abre a busca.

No pgAdmin, atualize `Databases → saveme_games → Schemas → public → Tables`. Para conferir as contas pelo Query Tool, use `SELECT id, name, email, "createdAt" FROM users;`. A aplicação se conecta diretamente ao PostgreSQL; o pgAdmin serve como ferramenta de administração.

Rotas de conta:

- `POST /api/auth/register`: JSON `{ "name": "Seu nome", "email": "voce@example.com", "password": "sua senha" }`; retorna 201 e usuário público.
- `POST /api/auth/login`: JSON com `email` e `password`; retorna 200 e usuário público.
- `GET /api/auth/me`: restaura a sessão ou retorna 401.
- `POST /api/auth/logout`: JSON `{}`; revoga a sessão no banco e remove o cookie.

E-mails são normalizados para minúsculas e únicos no banco. Senhas de 8 a 128 caracteres usam scrypt com salt aleatório. O JWT assinado com HS256 expira em sete dias, fica em cookie HttpOnly/SameSite=Lax e precisa corresponder a uma sessão válida no banco. O token não é armazenado no localStorage. Há limite compartilhado de 20 requisições de cadastro/login por IP por minuto, em memória e por processo. Corpos inválidos retornam 400, credenciais incorretas 401, origem inválida 403, duplicidade 409 e excesso de tentativas 429.

Em implantação HTTPS, configure `COOKIE_SECURE=true`, um segredo próprio, `AUTH_ORIGINS` com as origens permitidas e um proxy de mesma origem para `/api`. A API local continua escutando em `127.0.0.1`. Recuperação de senha depende da definição do canal de envio indicada como pendente nos PDFs; não está implementada nesta entrega.

`npm run test:auth` executa a verificação de hash. Para incluir os testes HTTP com o banco local migrado, no PowerShell:

```powershell
$env:AUTH_DB_TEST='1'
npm run test:auth
Remove-Item Env:AUTH_DB_TEST
```

Esses testes criam uma conta com e-mail aleatório e a removem ao concluir. Verificam cadastro, duplicidade, senha incorreta, persistência, cookies, expiração, revogação, origem e limite de tentativas. `npm run db:status` verifica as migrações.

Na raiz, `AUTH_DB_TEST=1` também habilita o teste de navegador `npm run test:e2e -- --grep '@postgres'`. No PowerShell, defina a variável com `$env:AUTH_DB_TEST='1'` e remova-a ao terminar. Esse fluxo cria e remove uma conta temporária, verifica cadastro e login reais, restauração após recarregar e logout. Os testes de interface padrão simulam as respostas da autenticação e não exigem banco.

Os adaptadores `.mjs` em `tools/steam` são reutilizados temporariamente; o build os copia junto da API. A migração para adaptadores TypeScript será uma tarefa própria. Os testes dos adaptadores continuam disponíveis a partir da raiz do repositório.
