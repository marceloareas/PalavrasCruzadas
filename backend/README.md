# API — Cruzadinha Digital

API REST em **Node.js + Express 5**, com **PostgreSQL** (dados relacionais) e
**MongoDB** (palavras e grade de cada versão). É consumida pelo front em React
(`../frontend`).

## Rodar

Pela raiz do repositório, tudo junto: `docker compose up --build`.

Só a API, com os bancos no Docker:

```bash
docker compose up postgres mongo     # na raiz
cd backend
cp .env.example .env
npm install
npm run dev                          # http://localhost:3000/api
```

## Testes

```bash
npm test      # gerador de grade, pontuação e dica (não precisam de banco)
```

## Organização

```
db/postgres/schema.sql   tabelas, CHECKs e índices (rodam na 1ª subida do container)
db/postgres/seed.sql     usuários, disciplinas, 1 solicitação
db/mongo/modelo.md       coleção conteudo_versao
src/server.js            conecta no Mongo, cria os exemplos e sobe a API
src/app.js               Express, sessão, /api/health, /api/regras, tratamento de erros
src/regras.js            limites (5–15 palavras…) e tabela de pontuação
src/seedExemplos.js      4 cruzadas + 3 partidas de exemplo
src/middleware/auth.js   sessão e papéis (ponto de integração com o Lúdica)
src/routes/              auth · cruzadas (professor, aluno, partida) · disciplinas
src/services/            cruzada, jogo, sessão, disciplina, usuário, gerador, pontuação
test/                    gerador.test.js, pontuacao.test.js, dica.test.js
```

## Documentação

- [Rotas da API](../docs/api.md)
- [Arquitetura e camadas](../docs/arquitetura.md)
- [Modelo de dados](../docs/modelo-de-dados.md)
- [Gerador de grade](../docs/gerador-de-grade.md)
- [Jogo e pontuação](../docs/jogo-e-pontuacao.md)
- [Guia de desenvolvimento](../docs/desenvolvimento.md) (usuários de teste, variáveis, problemas comuns)
