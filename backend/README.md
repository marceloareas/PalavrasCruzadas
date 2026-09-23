# Jogo de Palavras Cruzadas — Ciência da Computação (CEFET-RJ)

Aplicação web para criação e resolução de palavras cruzadas de disciplinas de
Ciência da Computação. Esta etapa entrega o **fluxo do professor**: cadastrar
uma palavra cruzada (com validação da grade) e **persistir no banco**.

- **Backend:** Node.js + Express
- **Frontend:** HTML renderizado no servidor (EJS) + JS
- **Banco:** PostgreSQL (em Docker)

## Como rodar (Docker)

```bash
docker compose up --build
```

- App: http://localhost:3000
- O banco sobe já com o **schema** e os **dados iniciais** (usuários e uma
  cruzada de exemplo), pois `db/schema.sql` e `db/seed.sql` são executados
  automaticamente na primeira subida do container do Postgres.

Para recriar o banco do zero (apaga o volume):

```bash
docker compose down -v && docker compose up --build
```

## Como rodar localmente (sem Docker para o app)

1. Suba só o banco: `docker compose up db`
2. `cp .env.example .env`
3. `npm install`
4. `npm start`

## Usuários de teste (seed)

Vêm como se o **Lúdica** os tivesse enviado (`id, usertag, email, papel`):

| id (Lúdica) | usertag       | papel     |
|-------------|---------------|-----------|
| 1001        | prof.ana      | professor |
| 1002        | prof.carlos   | professor |
| 2001        | aluno.bruno   | aluno     |
| 2002        | aluno.duda    | aluno     |
| 2003        | aluno.rafa    | aluno     |

Na tela `/login` você pode "entrar como" qualquer um, ou simular um novo
payload do Lúdica (faz *upsert* e já autentica).

## Fluxo do professor implementado

1. Entrar como professor (ex.: `prof.ana`).
2. **Nova cruzada** → título, descrição, disciplina (RN04: só uma),
   dificuldade (RN07) e a lista de palavras (resposta + dica + linha/coluna +
   direção). Há pré-visualização da grade em tempo real.
3. **Salvar** → o servidor valida a grade (RN06) e persiste:
   `palavra_cruzada` + `versao_cruzada` (v1) + `palavra`.
4. **Editar** → cria uma **nova versão** preservando o histórico (RN09).
5. **Excluir** → apenas o professor autor (RN03/RN08).

## Mapa das regras de negócio

| RN | Onde é tratada |
|----|----------------|
| RN01 | `usuario.papel CHECK`; upsert do Lúdica valida o papel |
| RN02 | middleware `requireProfessor` nas rotas de criação |
| RN03 / RN08 | `cruzadaService` confere `id_autor` antes de editar/excluir |
| RN04 | `palavra_cruzada.id_disciplina` (FK única) |
| RN05 | tabela `palavra` (resposta + dica) |
| RN06 | `gridValidator.validarGrade` (chamado ao salvar) |
| RN07 | `dificuldade CHECK (facil, medio, dificil)` |
| RN09 | edição cria nova `versao_cruzada`; sessões antigas ficam na versão jogada |
| RN10 | `sessao_jogo` permite N sessões por aluno/versão |
| RN12 | `sessao_jogo` (tempo, tentativas, acertos, erros, pontuação) |

> RN10–RN12 já estão modeladas no banco; a **jogabilidade do aluno** será
> implementada na próxima etapa.

## Testes

```bash
npm test
```

Cobre a validação da grade (intersecções, conflitos, mínimo de palavras,
grade desconectada e normalização de acentos).

## Estrutura

```
db/       schema.sql, seed.sql
src/
  db.js               pool + transações
  server.js           bootstrap do Express
  middleware/auth.js  sessão e controle de acesso (RN01/RN02)
  services/           usuarioService (Lúdica), cruzadaService, gridValidator
  routes/             auth, cruzadas
  views/              EJS (login, home, cruzadas/*)
public/   css, js
```
