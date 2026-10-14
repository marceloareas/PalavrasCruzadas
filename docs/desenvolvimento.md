# Guia de desenvolvimento

## Pré-requisitos

- Docker Desktop (aberto e rodando)
- Node.js 22+ (só para rodar testes ou desenvolver fora do Docker)

## Subir tudo

```bash
docker compose up --build
```

| O quê | Onde |
|---|---|
| Aplicação | http://localhost:8080 |
| API | http://localhost:3000/api (ex.: `/api/health`) |
| PostgreSQL | `localhost:5432`, usuário `postgres`, senha `postgres`, banco `palavras_cruzadas` |
| MongoDB | `localhost:27017`, banco `palavras_cruzadas` |

### Primeira subida e dados de exemplo

1. O Postgres roda `backend/db/postgres/schema.sql` e `seed.sql`, criando
   usuários, disciplinas e uma solicitação pendente.
2. A API cria a coleção do Mongo (com `$jsonSchema`) e, se não houver nenhuma
   cruzada, roda `src/seedExemplos.js`, que cria:
   - 4 cruzadas (ES publicada, GoF em rascunho, BD publicada, SO publicada),
     passando pelo mesmo gerador de grade do professor;
   - 3 partidas encerradas na cruzada de ES, com histórico de respostas e
     pontos calculados pela regra do jogo.

   Para não criar os exemplos: `SEED_EXEMPLOS=false`.

### Recomeçar do zero

Os scripts do Postgres **só rodam com o volume vazio**. Depois de mudar o
`schema.sql`, ou para limpar os dados:

```bash
docker compose down -v      # apaga os volumes pgdata e mongodata
docker compose up --build
```

## Usuários de teste

| id (Lúdica) | usertag | papel | Tem |
|---|---|---|---|
| 1002 | `prof.carlos` | professor | cruzadas de ES e GoF |
| 1001 | `prof.ana` | professor | cruzadas de BD e SO, 1 solicitação pendente |
| 2001 | `aluno.bruno` | aluno | 1 partida na cruzada de ES |
| 2002 | `aluno.duda` | aluno | 1 partida na cruzada de ES |
| 2003 | `aluno.rafa` | aluno | 1 partida na cruzada de ES |
| 9001 | `admin.dcc` | administrador | — |

Na tela de login, escolha em "Entrar como". Para testar um usuário novo, use
"Simular payload do Lúdica".

## Desenvolver fora do Docker

```bash
docker compose up postgres mongo         # só os bancos

cd backend
cp .env.example .env
npm install
npm run dev                              # API com reload, porta 3000

cd ../frontend
npm install
npm run dev                              # front com reload, porta 5173
```

Variáveis da API: veja `backend/.env.example` (`PG*`, `MONGO_URL`, `MONGO_DB`,
`PORT`, `SESSION_SECRET`, `SEED_EXEMPLOS`).

## Testes

```bash
cd backend
npm test
```

| Arquivo | Cobre |
|---|---|
| `test/gerador.test.js` | validação 5–15, dica, repetidas; grade sem conflito e sem sequências acidentais; determinismo; 15 palavras; palavra que não encaixa; matriz do aluno sem letras |
| `test/pontuacao.test.js` | tentativa do acerto (inclusive "acertou, estragou, acertou"), pontos por tentativa, dificuldade, bônus de tempo e de completar, partida incompleta |

Os testes não precisam de banco. Fluxos com banco (API) foram testados ponta a
ponta com scripts e com o navegador automatizado durante o desenvolvimento.

## Deploy em produção

`docker-compose.prod.yml` é aplicado por cima do compose de desenvolvimento:
só o nginx fica exposto, as senhas vêm do `.env.prod`, o MongoDB passa a
exigir usuário e senha e os containers reiniciam sozinhos.

```bash
cp .env.prod.example .env.prod      # troque todas as senhas
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Passo a passo completo, backup/restauração e HTTPS:
[Manual do Desenvolvedor, seção 8](manuais/manual-desenvolvedor.md#8-deploy-em-produção).

## Onde mexer para…

| Quero… | Arquivo |
|---|---|
| mudar o limite de palavras | `backend/src/regras.js` (`MIN_PALAVRAS`/`MAX_PALAVRAS`) **e** o `CHECK` de `versao_cruzada` em `schema.sql` |
| mudar os pontos | `backend/src/regras.js` → `PONTUACAO` |
| mudar o algoritmo da grade | `backend/src/services/gerador.js` (+ testes) |
| adicionar uma rota | `backend/src/routes/*.js` → service em `backend/src/services/` |
| adicionar uma tabela/coluna | `backend/db/postgres/schema.sql` + `docker compose down -v` |
| adicionar uma tela | `frontend/src/paginas/...` + rota em `frontend/src/main.jsx` (+ item de menu em `componentes/Layout.jsx`) |
| integrar o login com o Lúdica | `backend/src/middleware/auth.js` (`carregarUsuario`) |

## Problemas comuns

| Sintoma | Causa / solução |
|---|---|
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | O Docker Desktop está fechado. Abra e espere ficar "running". |
| Mudei o `schema.sql` e nada mudou | O volume já existe. Rode `docker compose down -v`. |
| Depois de reiniciar a API, todo mundo foi deslogado | A sessão fica em memória. É só entrar de novo. |
| Acentos chegam errados quando testo com `curl` | O Git Bash no Windows não manda UTF-8. Use `--data-binary @arquivo.json` (ver [api.md](api.md#testando-na-mão)). |
| Porta 5432/27017/3000/8080 ocupada | Outro container ou serviço está usando. Pare-o ou mude a porta do host no `docker-compose.yml`. |

## Git: branches e commits

Fluxo definido pelo grupo:

```text
feature/*  →  dev  →  homolog  →  main
```

- Crie a branch a partir da `dev`: `git checkout dev && git pull && git checkout -b feature/nome`.
- Abra o PR para a `dev`. Depois de testado, promova `dev` → `homolog` → `main`.
- Mensagens no padrão Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `chore:`, `style:`.

Situação atual das branches: ver [historico-e-decisoes.md](historico-e-decisoes.md#branches).
