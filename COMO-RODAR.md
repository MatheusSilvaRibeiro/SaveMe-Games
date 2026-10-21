# Como baixar e rodar o SaveMe Games

Este tutorial prepara o projeto para desenvolvimento local no **Windows**, usando PowerShell, PostgreSQL 17 e pgAdmin 4. Ao terminar, será possível criar uma conta, entrar, sair e buscar jogos na Steam.

Cada pessoa deve usar seu próprio banco local e suas próprias credenciais. O banco e o arquivo `.env` de outro desenvolvedor não são baixados pelo GitHub.

## 1. Instalar os programas necessários

Instale:

| Programa | Para que serve |
| --- | --- |
| [Git](https://git-scm.com/downloads) | Baixar e atualizar o repositório. É opcional se usar Download ZIP. |
| [Node.js](https://nodejs.org/en/download) **24** | Executar o site, a API e o npm. O projeto também aceita Node 22 a partir de 22.12. |
| [PostgreSQL 17](https://www.postgresql.org/download/windows/) | Armazenar usuários e sessões. |
| [pgAdmin 4](https://www.pgadmin.org/download/) | Administrar e visualizar o banco. Pode ser instalado junto do PostgreSQL. |

No instalador do PostgreSQL:

1. Inclua o servidor PostgreSQL e o pgAdmin 4.
2. Defina uma senha para o usuário `postgres` e guarde-a para configurar o projeto.
3. Mantenha a porta `5432`, caso esteja disponível.
4. Conclua a instalação. Não é necessário instalar complementos do Stack Builder para este projeto.

Depois das instalações, abra um **novo PowerShell** e confira:

```powershell
node --version
npm.cmd --version
git --version
```

O primeiro comando deve mostrar `v24.x.x` ou uma versão compatível do Node 22. O comando do Git só é necessário para quem vai clonar o repositório.

Neste guia usamos `npm.cmd`, que evita o bloqueio do arquivo `npm.ps1` pela política de execução do PowerShell. Não é necessário alterar a política do Windows. No Prompt de Comando, macOS ou Linux, os comandos npm podem ser escritos como `npm`.

## 2. Baixar o projeto pelo GitHub

Repositório: [MatheusSilvaRibeiro/SaveMe-Games](https://github.com/MatheusSilvaRibeiro/SaveMe-Games).

### Opção A: clonar com Git

Abra o PowerShell na pasta onde deseja guardar o projeto e execute:

```powershell
git clone https://github.com/MatheusSilvaRibeiro/SaveMe-Games.git
cd SaveMe-Games
```

Se o repositório for privado, entre no GitHub com uma conta que tenha acesso e conclua a autenticação solicitada pelo Git.

### Opção B: baixar ZIP

1. Abra o repositório no GitHub.
2. Clique em **Code → Download ZIP**.
3. Extraia o ZIP para uma pasta do computador.
4. Abra a pasta extraída e, nela, abra o PowerShell.

Nos próximos passos, todos os comandos são executados na **raiz do projeto**: a pasta que contém `package.json`, `src`, `tools` e `backend`.

Confira os arquivos necessários:

```powershell
Test-Path package.json
Test-Path backend/.env.example
Test-Path backend/prisma/schema.prisma
```

Os três comandos devem retornar `True`.

## 3. Criar o banco no pgAdmin 4

1. Abra o **pgAdmin 4**.
2. Na lateral, expanda **Servers** e selecione o servidor PostgreSQL 17.
3. Informe a senha do usuário PostgreSQL definida na instalação.

Se o servidor não aparecer, clique com o botão direito em **Servers → Register → Server** e preencha:

| Campo | Valor para a instalação padrão |
| --- | --- |
| General → Name | `PostgreSQL 17 local` |
| Connection → Host name/address | `127.0.0.1` |
| Connection → Port | `5432` |
| Connection → Maintenance database | `postgres` |
| Connection → Username | `postgres` |
| Connection → Password | Sua senha do PostgreSQL |

Salve e conecte. Se você escolheu outra porta ou usuário na instalação, use esses valores em todo o tutorial.

A senha mestra que o pgAdmin pode solicitar é diferente da senha do usuário `postgres`.

Para criar o banco:

1. Clique com o botão direito em **Databases → Create → Database**.
2. Em **Database**, escreva `saveme_games`.
3. Em **Owner**, selecione `postgres`, ou o usuário que você utilizará no projeto.
4. Clique em **Save**.

Se o banco já existir, utilize-o. As tabelas serão criadas pelas migrações; não é necessário criá-las manualmente.

### Alternativa: criar o banco com SQL

No pgAdmin, selecione o banco de manutenção **postgres** e abra **Tools → Query Tool**. Execute o comando abaixo sozinho, fora de uma transação e com o Auto-commit habilitado:

```sql
CREATE DATABASE saveme_games OWNER postgres;
```

Se você usa outro usuário, substitua `postgres` pelo nome dele. Execute somente se `saveme_games` ainda não existir. Depois, atualize **Databases** e abra um novo **Query Tool** conectado ao banco **saveme_games** para as consultas do projeto.

### SQL de criação das tabelas

O SQL completo de `CREATE TABLE`, chaves e índices está versionado neste arquivo:

[backend/prisma/migrations/202610200001_auth/migration.sql](backend/prisma/migrations/202610200001_auth/migration.sql)

Para instalar o projeto, aplique esse SQL pelo Prisma, no **terminal PowerShell**, depois de configurar o `.env` e instalar as dependências nos próximos passos:

```powershell
npm.cmd run db:migrate --prefix backend
```

Esse comando executa a migração e registra sua aplicação em `_prisma_migrations`. Não execute também o arquivo SQL manualmente: isso criaria as tabelas sem registrar a migração e causaria conflito quando o Prisma tentasse aplicá-la.

### SQL para conferir os dados

No **Query Tool conectado ao banco saveme_games**, depois de aplicar a migração:

```sql
-- Listar as tabelas do projeto.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Listar as contas cadastradas, sem expor hashes de senha.
SELECT id, name, email, "createdAt"
FROM public.users
ORDER BY "createdAt" DESC;

-- Conferir sessões e o usuário de cada uma.
SELECT s.id, u.email, s."createdAt", s."expiresAt",
       s."expiresAt" > CURRENT_TIMESTAMP AS dentro_da_validade
FROM public.sessions AS s
JOIN public.users AS u ON u.id = s."userId"
ORDER BY s."createdAt" DESC;

-- Conferir o histórico das migrações.
SELECT migration_name, started_at, finished_at
FROM public._prisma_migrations
ORDER BY started_at DESC;
```

Antes do primeiro cadastro, `users` e `sessions` estarão vazias. Crie a conta pelo site para que a API gere o hash da senha e a sessão corretamente.

## 4. Configurar o arquivo de ambiente

Na raiz do projeto, execute uma vez:

```powershell
Copy-Item backend/.env.example backend/.env
notepad backend/.env
```

Se `backend/.env` já existir e estiver configurado, edite o arquivo existente em vez de copiá-lo novamente.

Configure o conteúdo seguindo este modelo:

```dotenv
DATABASE_URL="postgresql://postgres:SUA_SENHA@127.0.0.1:5432/saveme_games?schema=public"
JWT_SECRET="COLE_AQUI_O_SEGREDO_GERADO_NO_PROXIMO_COMANDO"
AUTH_ORIGINS="http://127.0.0.1:5173,http://localhost:5173"
COOKIE_SECURE=false
```

- Substitua `SUA_SENHA` pela senha do seu usuário PostgreSQL.
- Se necessário, ajuste usuário, porta e nome do banco na `DATABASE_URL`.
- Para gerar o `JWT_SECRET`, execute o comando abaixo, copie o resultado e substitua o texto de exemplo. Use o resultado inteiro, sem quebra de linha.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Salve o arquivo no Bloco de Notas. O nome deve ser **`.env`**, e não `.env.txt`.

Se sua senha contiver caracteres especiais, codifique-os na URL. Por exemplo, uma senha fictícia `Minha@Senha#1` vira `Minha%40Senha%231` dentro da `DATABASE_URL`. Outros exemplos: `%` vira `%25`, `:` vira `%3A`, `/` vira `%2F` e `?` vira `%3F`. A senha para entrar no pgAdmin continua sendo a original.

O arquivo `backend/.env` já é ignorado pelo Git. Não publique a senha ou o segredo JWT. No ambiente local HTTP, mantenha `COOKIE_SECURE=false` para o navegador enviar o cookie de sessão.

O `.env` da raiz é opcional para rodar localmente: o Vite já encaminha `/api` para a API na porta 3000. Para seguir este guia, não é necessário configurar `VITE_API_BASE_URL`.

## 5. Instalar as dependências

Com internet disponível e ainda na raiz:

```powershell
npm.cmd run setup
```

Esse comando instala as dependências do site e da API usando os arquivos de lock do repositório e gera o cliente Prisma. Aguarde a conclusão sem erros. Na primeira execução, pode ser necessário baixar componentes do Prisma.

Não basta instalar apenas as dependências da raiz: a API também possui seu próprio `package.json` e `package-lock.json`.

## 6. Criar as tabelas com Prisma

Com o PostgreSQL iniciado e o arquivo `backend/.env` salvo, execute na raiz:

```powershell
npm.cmd run db:migrate --prefix backend
npm.cmd run db:status --prefix backend
```

O primeiro comando aplica as migrações versionadas; o segundo deve indicar que o banco está atualizado.

No pgAdmin, acesse **Databases → saveme_games → Schemas → public → Tables**. Clique com o botão direito em **Tables → Refresh**.

As tabelas esperadas são:

| Tabela | Conteúdo |
| --- | --- |
| `users` | Nome, e-mail, hash da senha e data de criação das contas. |
| `sessions` | Sessões de acesso, vínculo com o usuário e validade. |
| `_prisma_migrations` | Histórico das migrações aplicadas pelo Prisma. |

O Prisma conecta a API diretamente ao PostgreSQL. O pgAdmin é uma ferramenta de administração: pode ficar fechado enquanto o projeto roda. O serviço PostgreSQL precisa permanecer iniciado.

## 7. Iniciar o projeto

Na raiz, execute:

```powershell
npm.cmd run dev
```

O comando compila a API, inicia o backend, espera a resposta dele e inicia o site.

| Serviço | Endereço |
| --- | --- |
| Site | http://127.0.0.1:5173/ |
| Cadastro | http://127.0.0.1:5173/#/cadastro |
| Login | http://127.0.0.1:5173/#/login |
| Busca | http://127.0.0.1:5173/#/busca |
| Saúde da API | http://127.0.0.1:3000/api/health |

Mantenha o terminal aberto. **Ctrl+C** encerra o site e a API. Utilize o endereço `127.0.0.1` durante o teste completo para manter a mesma origem e os cookies da sessão.

## 8. Conferir se está funcionando

1. Abra a página de cadastro.
2. Preencha nome, e-mail, senha de 8 a 128 caracteres e confirmação da senha.
3. Clique em **Criar conta**. O site deve abrir a busca e mostrar seu nome no cabeçalho.
4. Recarregue a página. Sua sessão deve continuar ativa.
5. Clique em **Sair** e entre novamente pela página de login.
6. Busque um jogo, como `Portal 2`, e abra um resultado para consultar os detalhes.

Para verificar a conta no pgAdmin, abra o **Query Tool** do banco `saveme_games` e execute:

```sql
SELECT id, name, email, "createdAt"
FROM users
ORDER BY "createdAt" DESC;
```

A busca depende de conexão com a Steam e da disponibilidade da fonte externa. Não é necessário informar uma chave Steam para o fluxo atual. O endpoint `/api/health` confirma que a API está respondendo, mas não verifica a conexão com o banco ou a Steam. Para verificar o banco e a autenticação, conclua o cadastro e o login.

## 9. Rodar novamente em outro dia

Não é necessário reinstalar as dependências ou recriar o banco a cada uso. Inicie o PostgreSQL, abra o terminal na raiz do projeto e execute:

```powershell
npm.cmd run dev
```

Depois de baixar uma atualização que altera dependências ou migrações, com os servidores parados, execute:

```powershell
npm.cmd run setup
npm.cmd run db:migrate --prefix backend
npm.cmd run dev
```

Preserve o seu `backend/.env`. No desenvolvimento, reinicie os serviços após alterações no backend; o comando atual não acompanha automaticamente todas as mudanças da API.

## 10. Verificações opcionais

Na raiz:

```powershell
npm.cmd run build
npm.cmd test --prefix backend
```

O primeiro comando verifica os tipos e compila o site. O segundo compila a API e executa os testes padrão, com a Steam simulada. O teste de integração com PostgreSQL é opcional e fica desabilitado por padrão.

Para testar a autenticação com o banco real já migrado:

```powershell
$env:AUTH_DB_TEST='1'
npm.cmd run test:auth --prefix backend
Remove-Item Env:AUTH_DB_TEST
```

Para testar a interface, instale também o **Microsoft Edge**, pois o Playwright do projeto está configurado para utilizá-lo:

```powershell
npm.cmd run test:e2e
```

Para testar cadastro e login reais pelo navegador:

```powershell
$env:AUTH_DB_TEST='1'
npm.cmd run test:e2e -- --grep '@postgres'
Remove-Item Env:AUTH_DB_TEST
```

Os testes de integração criam contas temporárias e as removem ao concluir. Se já houver servidores em execução, eles precisam estar atualizados: o Playwright pode reutilizá-los. Uma API antiga pode responder à verificação de saúde e ainda não possuir as rotas novas.

## 11. Resolver problemas comuns

### O PowerShell bloqueia `npm.ps1`

Use `npm.cmd` no lugar de `npm`, como nos exemplos deste tutorial.

### `node`, `npm.cmd` ou `git` não são reconhecidos

Confira se o programa foi instalado e abra um novo terminal. Se estiver usando o terminal integrado de um editor, feche e abra o editor também para atualizar o PATH.

### Não foi possível conectar ao PostgreSQL

Abra os **Serviços do Windows** e confira se `postgresql-x64-17` está em execução. Confirme host, porta, usuário e senha no pgAdmin e no `backend/.env`.

Erros Prisma como `P1000` normalmente indicam credenciais inválidas; `P1001` indica que o servidor não pôde ser alcançado. O pgAdmin aberto não significa, por si só, que o servidor PostgreSQL está iniciado.

### O banco não existe ou as tabelas não aparecem

Crie `saveme_games` no servidor correto, confirme a URL de conexão e rode:

```powershell
npm.cmd run db:migrate --prefix backend
```

Atualize a lista de tabelas no pgAdmin. Não use comandos de reset para resolver a configuração inicial: eles podem apagar dados.

### O site abre, mas cadastro ou login falham

Confira se `backend/.env` existe, se a senha do banco está correta, se as migrações foram aplicadas e se `JWT_SECRET` foi substituído pelo segredo gerado. Reinicie `npm.cmd run dev` após alterar o ambiente.

Se aparecer `Cannot POST /api/auth/register` ou `Cannot GET /api/auth/me`, confira se a branch possui a integração e encerre a API antiga antes de iniciar a versão atualizada. Uma resposta **401** de `/api/auth/me` antes de entrar é esperada: significa que ainda não existe uma sessão autenticada.

### Porta 3000 ou 5173 ocupada

Encerre a execução anterior com **Ctrl+C** no terminal que a iniciou e tente novamente. Não execute o modo conjunto e os modos separados ao mesmo tempo.

Para seguir este guia, mantenha as portas padrão. Alterar a porta do site também exige ajustar as origens permitidas da autenticação.

### Falha de download durante o setup

Confira a conexão, o proxy ou as restrições de rede. O npm e o Prisma precisam baixar dependências. Depois de corrigir a conexão, rode `npm.cmd run setup` novamente.

### Muitas tentativas de login

O backend limita cadastro e login a 20 requisições por IP por minuto. Aguarde um minuto e tente novamente.

### A busca Steam falhou, mas o login funciona

Confira a conexão e tente novamente depois. A Steam é uma fonte externa; uma falha nela não significa que o banco ou a autenticação estão com problema.

## Limites desta configuração

Este guia configura desenvolvimento local. Publicação em um servidor exige configuração própria de HTTPS, proxy, origens, cookies e credenciais. Recuperação de senha ainda não está implementada. Wishlist, alertas e histórico não fazem parte desta entrega.
