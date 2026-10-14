# API — Cruzadinha Digital

API REST em **Node.js + Express**, com **PostgreSQL** (dados relacionais) e
**MongoDB** (conteúdo das cruzadas). É consumida pelo front em React
(`../frontend`). Modelo de dados em [`../docs/modelo-de-dados.md`](../docs/modelo-de-dados.md).

## Rodar

O jeito mais simples é subir tudo pela raiz do repositório:

```bash
docker compose up --build
```

Para desenvolver a API fora do Docker:

```bash
docker compose up postgres mongo      # na raiz: só os bancos
cd backend
cp .env.example .env
npm install
npm run dev                            # http://localhost:3000/api
npm test                               # testes do gerador de grade
```

Na primeira subida a API cria 4 cruzadas de exemplo (`src/seedExemplos.js`),
passando pelo mesmo gerador de grade usado pelo professor. Para recriar tudo do
zero: `docker compose down -v && docker compose up --build`.

## Estrutura

```
db/
  postgres/schema.sql   modelo relacional (roda na 1a subida do container)
  postgres/seed.sql     usuários, disciplinas, 1 solicitação
  mongo/modelo.md       modelo da coleção conteudo_versao
src/
  server.js             conecta no Mongo, roda o seed e sobe a API
  app.js                Express: sessão, rotas /api, tratamento de erros
  regras.js             limites (5–15 palavras etc.), expostos em GET /api/regras
  db/postgres.js        pool + transação
  db/mongo.js           conexão + coleção com $jsonSchema
  middleware/auth.js    sessão e controle por papel
  services/
    gerador.js          geração automática da grade (RN06/RN13/RN14)
    cruzadaService.js   CRUD do professor, versões, gravação Postgres + Mongo
    jogoService.js      busca, tabuleiro sem respostas (RN11) e ranking
    sessaoService.js    partida: iniciar, conferir, encerrar (RN10/RN12/RN18)
    pontuacao.js        cálculo dos pontos (RN19), valores em regras.js
    disciplinaService.js  Manter Disciplina + solicitações (RN15/RN16)
    usuarioService.js   upsert do usuário vindo do Lúdica
  routes/               auth, disciplinas, cruzadas
test/gerador.test.js
```

## Rotas

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| GET | `/api/regras` | todos | limites de palavras/letras |
| GET | `/api/auth/usuarios` | todos | usuários para “entrar como” (login simulado) |
| POST | `/api/auth/entrar` | todos | `{ id_usuario }` |
| POST | `/api/auth/ludica` | todos | simula o Lúdica: `{ id, usertag, email, papel, nome? }` |
| GET | `/api/auth/eu` · POST `/api/auth/sair` | logado | sessão |
| GET | `/api/professor/cruzadas` | professor | suas cruzadas + estatísticas |
| POST | `/api/professor/cruzadas` | professor | cria: `{ titulo, descricao, id_disciplina, dificuldade, status, palavras: [{ resposta, dica }] }` |
| GET / PUT / DELETE | `/api/professor/cruzadas/:id` | professor autor | detalhe com gabarito / edita (nova versão se as palavras mudarem) / exclui |
| GET | `/api/jogos?texto=&codigo=&disciplina=&dificuldade=` | aluno | busca jogos publicados |
| GET | `/api/jogos/:id` | aluno | grade vazia + dicas (sem respostas), ranking e minhas partidas |
| POST | `/api/jogos/:id/sessoes` | aluno | inicia uma partida (ou retoma a que está aberta) |
| GET | `/api/sessoes/:id` | aluno dono | estado da partida; gabarito e pontuação só depois de encerrada |
| POST | `/api/sessoes/:id/conferir` | aluno dono | `{ respostas: { indice: "PALAVRA" } }` → `{ tentativa, certas, total, concluida }` |
| POST | `/api/sessoes/:id/encerrar` | aluno dono | encerra e pontua com a última conferência |
| GET | `/api/disciplinas` (`?todas=1` p/ admin) | logado | lista disciplinas |
| POST / PUT / DELETE | `/api/disciplinas[/:id]` | administrador | Manter Disciplina |
| GET / POST | `/api/solicitacoes` | professor / admin | professor cria e vê as suas; admin vê todas |
| POST | `/api/solicitacoes/:id/responder` | administrador | `{ aprovar, nome?, codigo?, resposta? }` |

Erros de validação voltam como `422 { erro, erros: [...] }`.

## Usuários de teste

| id (Lúdica) | usertag | papel |
|---|---|---|
| 1002 | prof.carlos | professor |
| 1001 | prof.ana | professor |
| 2001 | aluno.bruno | aluno |
| 2002 | aluno.duda | aluno |
| 2003 | aluno.rafa | aluno |
| 9001 | admin.dcc | administrador |

## Login / Lúdica

O sistema deve rodar dentro do Lúdica, que fará a autenticação. Como essa
integração ainda não está definida, o login é simulado (“entrar como” ou envio
manual do payload do Lúdica). A troca fica concentrada em
`src/middleware/auth.js` (`carregarUsuario`): quando o Lúdica estiver pronto,
basta ler o usuário do token/cabeçalho que ele enviar.
