# API SaveMe em desenvolvimento

Primeiro recorte: busca e detalhes da Steam. Sem autenticação ou banco ainda.

Na pasta `backend`, com Node.js 22:

```powershell
npm ci
npm run dev
```

`npm run dev` compila e inicia; reinicie após editar. `npm test` compila e executa testes HTTP com a Steam simulada.

Rotas locais:

- `GET /api/health`: saúde da API, sem verificar Steam ou banco.
- `GET /api/steam/featured`: destaques da Steam em páginas de 12 títulos. Use `?page=2` para continuar; `proximaPagina` indica a próxima página disponível. A fonte combina mais vendidos, ofertas e novidades, sem duplicatas.
- `GET /api/steam/games?q=Portal%202`: resultados para seleção, incluindo possíveis DLCs e trilhas sonoras.
- `GET /api/steam/games/620`: detalhes e preço em BRL quando disponível.

Porta padrão 3000; configure `API_PORT` no ambiente se precisar. O processo escuta apenas em 127.0.0.1 nesta etapa.

Erros: 400 entrada inválida, 404 produto indisponível na consulta, 502 resposta externa inválida/HTTP de falha, 503 falha de conexão, 504 tempo esgotado. Preço ausente é null; gratuito é zero com indicação da fonte.

Os endpoints `featuredcategories`, `storesearch` e `appdetails` são da loja Steam e foram testados experimentalmente. Não há garantia de estabilidade ou cobertura estabelecida por esta investigação. Limites e condições de uso ainda precisam ser avaliados. Há cache público em memória por cinco minutos (até 100 entradas), compartilhamento de consultas simultâneas e limite de três consultas externas de detalhes em andamento. Os detalhes usam timeout de 2,5 segundos; falhas preservam os dados básicos da busca sem inventar gratuidade ou gênero. A busca enriquece até 12 resultados. Não há persistência nem meta de disponibilidade comprovada. O horário retornado indica nossa consulta, não a data de alteração do preço na loja.

Os adaptadores `.mjs` em `tools/steam` são reutilizados temporariamente; o build os copia junto da API. A migração para adaptadores TypeScript será uma tarefa própria. Os testes dos adaptadores continuam disponíveis a partir da raiz do repositório.
