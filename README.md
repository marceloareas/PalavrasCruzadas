# 🎮 Cruzadinha Digital

Sistema educacional gamificado baseado em palavras cruzadas, desenvolvido para permitir que professores criem atividades acadêmicas e que alunos possam acessá-las e resolvê-las de forma interativa.

A aplicação será integrada futuramente, via API, à central de jogos **Lúdica**, permitindo que os jogos da Cruzadinha Digital façam parte do ecossistema da plataforma.

---

## 📚 Sobre o sistema

A **Cruzadinha Digital** permite transformar conteúdos acadêmicos em desafios interativos.

O professor poderá:

* Criar novos jogos;
* Definir o tema acadêmico da atividade;
* Cadastrar perguntas e respostas;
* Gerar a estrutura da cruzadinha;
* Editar e revisar a atividade;
* Publicar o jogo;
* Compartilhar o jogo com os alunos;
* Acompanhar o desempenho dos participantes.

Os alunos poderão:

* Visualizar jogos disponíveis;
* Acessar jogos através de um código;
* Resolver as cruzadinhas;
* Receber feedback sobre suas respostas;
* Acompanhar sua pontuação;
* Visualizar resultados e rankings.

### Exemplo de utilização

Um professor da disciplina de **Engenharia de Software** cria um jogo chamado:

> Engenharia de Software — Conceitos Fundamentais

Ele cadastra perguntas como:

> Qual modelo de desenvolvimento divide o projeto em ciclos incrementais?

Resposta:

> INCREMENTAL

O sistema utiliza as respostas cadastradas para montar a cruzadinha.

O professor então publica o jogo e disponibiliza um código para os alunos.

Os alunos acessam o código, iniciam o desafio e respondem às perguntas através da cruzadinha.

---

## 🎯 Objetivos

* Tornar atividades acadêmicas mais interativas;
* Estimular a aprendizagem através de gamificação;
* Facilitar a criação de atividades por professores;
* Permitir que alunos pratiquem conteúdos de diferentes disciplinas;
* Integrar jogos educacionais à central **Lúdica**;
* Disponibilizar dados de desempenho para acompanhamento dos alunos.

---

## 👥 Perfis de usuário

### Professor

Responsável pela criação e gerenciamento dos jogos.

Principais funcionalidades:

* Dashboard;
* Criação de jogos;
* Cadastro de perguntas e respostas;
* Geração da cruzadinha;
* Edição de atividades;
* Publicação;
* Compartilhamento;
* Acompanhamento de resultados.

### Aluno

Responsável por participar dos jogos.

Principais funcionalidades:

* Visualização de jogos;
* Entrada através de código;
* Resolução da cruzadinha;
* Pontuação;
* Resultados;
* Ranking.

### Administrador

Responsável pelo cadastro de disciplinas.

Principais funcionalidades:

* Manter disciplinas (criar, editar, desativar);
* Responder solicitações de disciplina feitas pelos professores.

---

## 🔌 Integração com a Lúdica

A Cruzadinha Digital será integrada futuramente à **Lúdica**, uma central de jogos educacionais.

A comunicação entre os sistemas será realizada através de uma API.

A integração poderá contemplar:

* Autenticação;
* Usuários;
* Jogos;
* Dados das atividades;
* Códigos de acesso;
* Resultados;
* Pontuações;
* Dados de desempenho.

A implementação detalhada da integração será definida durante o desenvolvimento do sistema.

---

# 🌿 Estratégia de Branches

O projeto utilizará uma estratégia simples de branches para separar desenvolvimento, homologação e produção.

```text
feature/*
    ↓
   dev
    ↓
 homolog
    ↓
  main
```

### `main`

Branch de **produção**.

Deve conter somente versões estáveis e validadas do sistema.

Não devem ser realizadas alterações diretamente nessa branch.

---

### `homolog`

Branch destinada ao ambiente de **homologação**.

É utilizada para validar as funcionalidades antes que sejam disponibilizadas em produção.

Fluxo:

```text
dev → homolog
```

Após os testes e aprovação:

```text
homolog → main
```

---

### `dev`

Branch principal de **desenvolvimento e integração**.

As novas funcionalidades devem ser integradas nessa branch antes de serem encaminhadas para homologação.

```text
feature/* → dev
```

---

### `feature/*`

Branches utilizadas para desenvolver funcionalidades específicas.

Exemplos:

```text
feature/login
feature/criacao-jogo
feature/cadastro-perguntas
feature/geracao-cruzadinha
feature/jogo-aluno
feature/ranking
feature/resultados
feature/integracao-ludica
```

Após a conclusão da funcionalidade, a branch deve ser integrada à `dev`.

---

## 🔄 Fluxo de Desenvolvimento

1. Criar uma branch a partir de `dev`:

```bash
git checkout dev
git pull
git checkout -b feature/nome-da-funcionalidade
```

2. Desenvolver a funcionalidade.

3. Realizar commits seguindo uma descrição clara:

```bash
git add .
git commit -m "feat: adiciona criação de jogos"
```

4. Enviar a branch para o repositório:

```bash
git push -u origin feature/nome-da-funcionalidade
```

5. Abrir Pull Request para `dev`.

6. Após integração e testes em desenvolvimento, promover `dev` para `homolog`.

7. Após validação em homologação, promover `homolog` para `main`.

---

## 📝 Convenção de Commits

Sugestão de utilização do padrão **Conventional Commits**:

| Prefixo     | Utilização                      |
| ----------- | ------------------------------- |
| `feat:`     | Nova funcionalidade             |
| `fix:`      | Correção de bug                 |
| `refactor:` | Refatoração                     |
| `docs:`     | Documentação                    |
| `test:`     | Testes                          |
| `chore:`    | Configurações/manutenção        |
| `style:`    | Alterações de estilo/formatação |

Exemplos:

```bash
feat: adiciona criação de jogos
feat: implementa cadastro de perguntas
fix: corrige seleção de células da cruzadinha
docs: atualiza documentação da API
test: adiciona testes para geração da cruzadinha
```

---

## 🧩 Implementação atual (Sprint 3)

- **Front-end:** React + Vite ([`frontend/`](frontend/))
- **Back-end:** Node.js + Express, API REST ([`backend/`](backend/))
- **Bancos:** PostgreSQL (usuários, disciplinas, cruzadas, versões, sessões) + MongoDB (palavras e grade gerada de cada versão)
- **Tudo em Docker:** `docker compose up --build` na raiz → http://localhost:8080

| Perfil | O que já funciona |
|---|---|
| Professor | criar, editar (com versões) e excluir/arquivar jogos cadastrando **só respostas e dicas** — a grade é gerada automaticamente; solicitar disciplina nova |
| Aluno | pesquisar jogos publicados por texto, código, disciplina e dificuldade; ver o tabuleiro e as dicas (sem respostas) e o histórico de partidas |
| Administrador | manter disciplinas; aprovar/recusar solicitações dos professores |

O login ainda é **simulado** (“entrar como” um usuário de teste ou enviar o payload do Lúdica), porque a autenticação será feita pelo Lúdica e essa integração ainda não está definida.

Documentação:

- [Regras de negócio e casos de uso (v2)](docs/regras-e-casos-de-uso.md)
- [Modelo de dados — PostgreSQL + MongoDB](docs/modelo-de-dados.md)
- [API: rotas, usuários de teste e como rodar sem Docker](backend/README.md)

---

## 🚧 Status do Projeto

**Em desenvolvimento.** Próxima etapa: o aluno resolver a cruzadinha, com registro de tempo, tentativas, acertos/erros, pontuação e ranking (RN10–RN12 — as tabelas já existem).

---

## 🗂️ Estrutura

```text
PalavrasCruzadas/
├── docker-compose.yml   postgres + mongo + api + web
├── backend/             API Node/Express (ver backend/README.md)
│   ├── db/postgres/     schema.sql, seed.sql
│   ├── db/mongo/        modelo da coleção conteudo_versao
│   ├── src/
│   └── test/
├── frontend/            React + Vite (servido por nginx no Docker)
│   └── src/paginas/     professor/, aluno/, admin/
└── docs/                regras de negócio, casos de uso, modelo de dados
```

| Serviço | Endereço |
|---|---|
| Aplicação (React) | http://localhost:8080 |
| API | http://localhost:3000/api |
| PostgreSQL | localhost:5432 (postgres/postgres) |
| MongoDB | localhost:27017 |

Para desenvolver o front com recarga automática: `cd frontend && npm install && npm run dev` (http://localhost:5173, usa a API em `localhost:3000`).

---

## 🚀 Próximos passos

* [x] Definir arquitetura e stack (React · Node/Express · PostgreSQL + MongoDB · Docker);
* [x] Gerenciamento de usuários vindos do Lúdica (simulado);
* [x] Criação de jogos e cadastro de perguntas e respostas;
* [x] Algoritmo de geração da cruzadinha;
* [x] Perfil administrador e manutenção de disciplinas;
* [x] Busca de jogos pelo aluno;
* [ ] Experiência de jogo do aluno (resolver a cruzadinha);
* [ ] Pontuação e ranking;
* [ ] Resultados para professores;
* [ ] Integração real com a Lúdica (autenticação);
* [ ] Ambientes de homologação e produção.
