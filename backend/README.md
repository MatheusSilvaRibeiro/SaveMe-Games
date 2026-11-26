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
- `GET /api/comparisons/steam/:appId`: consulta pública para a extensão, por exemplo `/api/comparisons/steam/1145360` para Hades. Usa o AppID da associação conferida e retorna o mesmo JSON da rota por ID interno. AppID inválido retorna 400. AppID válido sem associação retorna 404.
- `GET /api/comparisons/:gameId`: compara as ofertas do jogo associado (por exemplo, `celeste`). Retorna `jogo`, `ofertas`, `situacao`, `menorPrecoCentavos`, `lojasMenorPreco` e `economiaCentavos`. Quando a consulta é parcial ou não há preços, os valores de menor preço e economia são `null`. IDs sem associação retornam 404; IDs inválidos retornam 400. As rotas de comparação são públicas e retornam `503 CATALOG_UNAVAILABLE` se o PostgreSQL estiver indisponível.
- `GET /api/epic/games?q=Celeste&page=1`: busca Epic via EGData. Sem `q`, lista ofertas de PC com preço e página disponíveis para o Brasil.
- `GET /api/epic/games/:offerId`: detalhes e preço regional Epic via EGData.

- `GET /api/health`: saúde da API, sem verificar Steam ou banco.
- `GET /api/steam/featured`: destaques da Steam em páginas de 12 títulos. Use `?page=2` para continuar; `proximaPagina` indica a próxima página disponível. A fonte combina mais vendidos, ofertas e novidades, sem duplicatas.
- `GET /api/steam/games?q=Portal%202`: resultados para seleção, incluindo possíveis DLCs e trilhas sonoras.
- `GET /api/steam/games/620`: detalhes e preço em BRL quando disponível.

A API avulsa usa a porta padrão 3000 e escuta em `127.0.0.1`. Configure `API_HOST` para outro endereço. `PORT` tem prioridade sobre `API_PORT` ao iniciar a API avulsa ou em produção. No desenvolvimento com o comando integrado, `API_PORT` controla a API e o destino do proxy Vite.

Erros: 400 entrada inválida, 404 produto indisponível na consulta, 502 resposta externa inválida/HTTP de falha, 503 falha de conexão, 504 tempo esgotado. Preço ausente é null; gratuito é zero com indicação da fonte.

Os endpoints `featuredcategories`, `storesearch` e `appdetails` são da loja Steam e foram testados experimentalmente. Não há garantia de estabilidade ou cobertura estabelecida por esta investigação. Limites e condições de uso ainda precisam ser avaliados. Há cache público em memória por cinco minutos (até 100 entradas), compartilhamento de consultas simultâneas e limite de três consultas externas de detalhes em andamento. Os detalhes usam timeout de 2,5 segundos; falhas preservam os dados básicos da busca sem inventar gratuidade ou gênero. A busca enriquece até 12 resultados. Os preços não são persistidos e a meta de disponibilidade ainda não foi comprovada. O horário retornado indica nossa consulta, não a data de alteração do preço na loja.

## Associações e comparação

`PrismaGameAssociations` lista e resolve as associações no PostgreSQL, por ID interno ou por AppID Steam. Configure o banco e, depois de compilar e migrar, execute `npm run db:seed:catalog`. O JSON em `data/game-associations.json` fornece Hades, Hades II, Celeste, Dead Cells e Among Us para PC. A carga preserva os IDs internos, a edição e a plataforma. Ela pode ser repetida e rejeita alterações de identidade para ofertas existentes.

A migration `202611220001_catalog_price_observations` adiciona `games`, `stores`, `store_offers` e `price_observations`. Na integração com a recuperação de senha, mantenha as migrations em diretórios distintos e valide as duas em um banco descartável antes de publicar.

Cada oferta é única por jogo e loja. O AppID Steam e o par namespace + offerId Epic também são únicos. Observações guardam centavos inteiros, moeda, região, estado, horário de consulta e data do registro na fonte quando fornecida. `0` representa oferta gratuita. Ausência de preço ou indisponibilidade observada usa `null`. Falhas sem horário de consulta válido não geram observação. Consultas com a mesma oferta, região e horário de consulta geram uma única observação.

`src/comparison/service.ts` consulta as duas lojas em paralelo e valida identidade, tipo de conteúdo, região e moeda. Menor preço e economia exigem duas ofertas válidas. Empate mantém as duas lojas como menor preço; falhas de uma fonte preservam a outra oferta, sem declarar vencedora. Preço ausente é `null`; zero válido representa gratuidade na oferta. Descontos usam o preço original da própria loja.

O resultado completo é mantido em cache por 60 segundos; resultados parciais, por 10 segundos. As integrações podem reutilizar preços por até cinco minutos. Consultas simultâneas ao mesmo jogo são compartilhadas e os horários originais são preservados. O teste determinístico usa um repositório fornecido explicitamente. Para testar a persistência, migre e carregue o catálogo em um PostgreSQL descartável de loopback com nome terminado em `_test`. Aponte `CATALOG_TEST_DATABASE_URL` para ele e execute `npm test`. O teste registra observações com respostas simuladas das lojas. Na raiz, `npm run test:production` também usa essa variável para verificar a listagem no banco descartável. Sem a variável, o teste de produção verifica o erro 503 da comparação sem banco configurado.

## Banco e autenticação

1. No pgAdmin 4, conecte ao PostgreSQL 17 usando host `127.0.0.1`, porta `5432` e seu usuário PostgreSQL. A senha mestra do pgAdmin é independente da senha do PostgreSQL.
2. Crie o banco `saveme_games` se ele ainda não existir.
3. Copie `.env.example` para `.env` nesta pasta e preencha `DATABASE_URL` e um `JWT_SECRET` aleatório. A senha na URL deve ter os caracteres especiais codificados. O arquivo `.env` é ignorado pelo Git.
4. Execute `npm run db:migrate`. O Prisma exige `DATABASE_URL` para a tarefa de migration. A migração versionada cria as tabelas `users` e `sessions` sem apagar registros.
5. Inicie o projeto com `npm run dev` na raiz. Cadastre-se em `http://127.0.0.1:5173/#/cadastro`; o sucesso inicia uma sessão e abre a busca.

No pgAdmin, atualize `Databases → saveme_games → Schemas → public → Tables`. Para conferir as contas pelo Query Tool, use `SELECT id, name, email, "createdAt" FROM users;`. A aplicação se conecta diretamente ao PostgreSQL; o pgAdmin serve como ferramenta de administração.

Rotas de conta:

- `POST /api/auth/register`: JSON `{ "name": "Seu nome", "email": "voce@example.com", "password": "sua senha" }`; retorna 201 e usuário público.
- `POST /api/auth/login`: JSON com `email` e `password`; retorna 200 e usuário público.
- `GET /api/auth/me`: restaura a sessão ou retorna 401.
- `POST /api/auth/logout`: JSON `{}`; revoga a sessão no banco e remove o cookie.

E-mails são normalizados para minúsculas e únicos no banco. Senhas de 8 a 128 caracteres usam scrypt com salt aleatório. O JWT assinado com HS256 expira em sete dias, fica em cookie HttpOnly/SameSite=Lax e precisa corresponder a uma sessão válida no banco. O token não é armazenado no localStorage. Há limite compartilhado de 20 requisições de cadastro/login por IP por minuto, em memória e por processo. Corpos inválidos retornam 400, credenciais incorretas 401, origem inválida 403, duplicidade 409 e excesso de tentativas 429.

O cookie atual é `saveme_session_api`, com caminho `/api`. `GET /api/auth/me` transfere uma sessão legada válida de `saveme_session` em `/api/auth` sem renovar a validade, e expira o cookie antigo. Quando os dois aparecem, o atual tem prioridade. Cadastro, login e logout limpam o cookie legado. Ao integrar a recuperação de senha, reutilize o gerenciamento de sessão em `AuthService` para emissão, revogação e limpeza. Verifique as duas migrations juntas em banco descartável.

Na implantação HTTPS, configure `COOKIE_SECURE=true`, um segredo próprio e `AUTH_ORIGINS` com as origens permitidas. Consulte o [roteiro de produção](../README.md#execução-de-produção-e-preparação-para-nuvem) para servir site e API juntos, configurar proxies confiáveis e executar migrations como tarefa separada. Recuperação de senha depende da definição do canal de envio indicada como pendente nos PDFs e segue pendente nesta entrega.

`npm run test:auth` executa a verificação de hash. Para incluir os testes HTTP com o banco local migrado, no PowerShell:

```powershell
$env:AUTH_DB_TEST='1'
npm run test:auth
Remove-Item Env:AUTH_DB_TEST
```

Esses testes criam uma conta com e-mail aleatório e a removem ao concluir. Verificam cadastro, duplicidade, senha incorreta, persistência, cookies, expiração, revogação, origem e limite de tentativas. `npm run db:status` verifica as migrações.

Na raiz, `AUTH_DB_TEST=1` também habilita o teste de navegador `npm run test:e2e -- --grep '@postgres'`. No PowerShell, defina a variável com `$env:AUTH_DB_TEST='1'` e remova-a ao terminar. Esse fluxo cria e remove uma conta temporária, verifica cadastro e login reais, restauração após recarregar e logout. Os testes de interface padrão simulam as respostas da autenticação e não exigem banco.

Os adaptadores `.mjs` em `tools/steam` são reutilizados temporariamente; o build os copia junto da API. A migração para adaptadores TypeScript será uma tarefa própria. Os testes dos adaptadores continuam disponíveis a partir da raiz do repositório.

## Favoritos

- `GET /api/favorites` retorna uma lista privada com `id`, `nome`, `edicao`, `plataforma` e `imagem`, ou uma lista vazia.
- `PUT /api/favorites/:gameId` adiciona o jogo e `DELETE /api/favorites/:gameId` remove. Envie JSON `{}` e as credenciais da sessão. Repetir a mesma operação devolve `204` enquanto o jogo existir. ID inválido retorna `400`, jogo inexistente retorna `404`, sessão ausente ou inválida retorna `401`, origem recusada retorna `403` e formato diferente de JSON retorna `415`.

O usuário é obtido da sessão. A migration `202611220002_user_favorites` cria uma tabela com chave composta por usuário e jogo. Após migrar e carregar o catálogo em um PostgreSQL descartável de loopback com nome terminado em `_test`, defina `FAVORITES_TEST_DATABASE_URL` e execute `npm test --prefix backend` na raiz. Para executar o cenário real de navegador, configure a API com o mesmo banco em `DATABASE_URL` e um `JWT_SECRET` de teste, e rode `npm run test:e2e -- e2e/favorites.spec.ts`. O cenário real cria uma conta de teste no banco descartável.

## Coleta e histórico de preços

Após o build, a migration e a carga do catálogo, execute `npm run prices:collect` na raiz com `DATABASE_URL` apontando para o banco autorizado. Se o artefato estiver no contêiner, execute `npm run prices:collect --prefix backend`. Agende o comando como tarefa do provedor. A coleta abre até três consultas de oferta em paralelo, com cinco segundos de timeout por requisição externa. A Epic pode exigir duas requisições por oferta. A tarefa deixa de iniciar lotes novos após quatro minutos e o prazo da transação é de quatro minutos e meio. O lock consultivo do PostgreSQL impede tarefas sobrepostas no mesmo banco e é liberado ao encerrar a transação. A conexão é encerrada ao sair.

O comando retorna `0` ao concluir sem falhas, `1` se houver falha total, parcial ou ofertas não processadas, e `2` se outra coleta estiver ativa. O resumo informa ofertas processadas, inserções, duplicatas e falhas por loja. Observações e avisos são gravados em transações por lote. Uma falha de banco pode desfazer o lote em andamento, preservando os lotes já concluídos. Não há reconsulta automática dentro do mesmo lote.

A coleta usa os adaptadores diretos de Steam e EGData, sem o cache da comparação. Preços válidos iguais em consultas diferentes são observações distintas. A mesma oferta, região e data de consulta tem uma única observação. Preço ausente e indisponibilidade sem erro de rede têm preço `null`. Timeout, falha de rede ou resposta incompatível deixam as observações anteriores intactas.

`GET /api/comparisons/history/:gameId?days=30&limit=120` retorna séries separadas por loja para `BR` e `BRL`. `days` aceita de 1 a 365 dias de 24 horas e `limit` aceita de 1 a 500 observações **por loja**. O limite seleciona os registros mais recentes, exibidos em ordem cronológica. `since`, `until`, `collectedAt` e `sourceRecordedAt` são ISO 8601 em UTC. `collectedAt` vem da consulta, e `sourceRecordedAt` indica a data informada pela fonte, quando houver. O gráfico exibe as datas em `America/Sao_Paulo`. Um jogo conhecido pode retornar séries vazias. Parâmetros inválidos retornam 400, jogo desconhecido retorna 404 e falha de banco retorna 503.

Para o teste de integração, prepare um PostgreSQL descartável novo de loopback com nome terminado em `_test`, aplique as migrations e carregue as associações. Aponte `HISTORY_TEST_DATABASE_URL` para ele e rode `npm test --prefix backend` na raiz. O banco é real e as respostas das lojas são simuladas. Na raiz, `npm run test:e2e -- e2e/price-history.spec.ts` testa a interface com a API simulada.

## Avisos de queda de preço

A migration `202611220003_price_drop_alerts` adiciona `price_alerts` e um índice de busca da observação anterior. Os registros existentes permanecem disponíveis como referência, sem geração retroativa de avisos.

A coleta e a comparação usam o mesmo gravador de observações. Quando insere uma observação com preço válido, ele busca a última observação válida já disponível com horário estritamente anterior, para a mesma oferta, região e moeda. Só há aviso se o preço cair e o favorito existir com data de criação anterior à consulta. Preço zero confirmado é válido. Ausência de preço, falha, primeiro preço, empate e aumento não geram aviso. Observações atrasadas são avaliadas contra o histórico disponível na gravação. Elas não recalculam avisos anteriores.

O lock por oferta serializa as gravações concorrentes. A observação e os avisos do lote são gravados juntos. Uma observação já inserida é ignorada em reexecuções, inclusive quando outro usuário adicionou o jogo aos favoritos depois. Cada aviso guarda os preços, jogo, loja, URL, mercado e horário da consulta. O aviso permanece na conta após novas coletas ou remoção do favorito.

- `GET /api/alerts?limit=20&before=<cursor>` retorna `items` e `nextCursor`. O limite é de 1 a 50. Passe o cursor recebido para buscar a próxima página. Datas da API estão em UTC e a página usa o horário de Brasília.
- `GET /api/alerts/unread` retorna `{ count }` para a conta da sessão. O contador é atualizado ao navegar, ao voltar o foco à janela e após marcar leitura.
- `PATCH /api/alerts/:id/read` recebe JSON `{}` e retorna `204` mesmo quando o aviso já está lido. A escrita verifica a origem e responde `404` quando o aviso não pertence à conta.

Os avisos aparecem no aplicativo à medida que uma consulta registra a queda. Ainda não há canal de e-mail. A detecção grava os avisos independentemente do canal de entrega. `readAt` indica leitura no aplicativo.

Para validar, migre e carregue um PostgreSQL descartável novo de loopback com nome terminado em `_test`. Aponte `ALERTS_TEST_DATABASE_URL` para esse banco e execute `npm test --prefix backend`. O banco é real e as fontes de preço são simuladas. Execute `npm run test:e2e -- e2e/price-alerts.spec.ts` para os cenários de interface com API simulada.

Para o fluxo completo, use outro banco descartável novo e já migrado e carregado. Defina `INTEGRATED_TEST_DATABASE_URL` e execute `npm test --prefix backend`. O teste cria duas contas, registra duas coletas simuladas, compara histórico e avisos por conta, verifica leitura em uma nova sessão e confirma a revogação no logout.

## Preferencias de avisos

`GET /api/preferences` retorna `{ "priceAlertsEnabled": true }` da conta autenticada. `PATCH /api/preferences` recebe somente esse booleano, valida origem e sessao e nunca aceita outro usuario como destino. Respostas: 200 sucesso, 400 corpo invalido, 401 sem sessao e 403 origem nao autorizada. A migration `202611260001_notification_preferences` preserva contas existentes com a opcao ativada.

Ao desativar, novos registros de queda nao geram avisos para a conta. Avisos antigos e favoritos permanecem; reativar nao processa quedas retroativas. A preferencia controla o canal dentro do site. Nao existe envio de e-mail nesta versao. Teste integrado opcional: `PREFERENCES_TEST_DATABASE_URL` deve apontar exclusivamente para PostgreSQL descartavel de loopback e banco com sufixo `_test`.
