# Matriz CRUD

Quem **C**ria, **R** (lê), **U** (atualiza) e **D** (exclui) cada entidade,
por perfil e por caso de uso. As entidades são as tabelas do
[dicionário de dados](dicionario-de-dados.md); os casos de uso estão em
[casos-de-uso.md](casos-de-uso.md).

## Entidade × perfil

| Entidade | Professor | Aluno | Administrador | Lúdica / sistema |
|---|---|---|---|---|
| `usuario` | R¹ | R¹ | R¹ | **C U** (upsert) |
| `disciplina` | R (ativas) | R (ativas, filtro) | **C R U D**² | — |
| `solicitacao_disciplina` | **C R**³ | — | **R U**⁴ | — |
| `palavra_cruzada` | **C R U D**⁵ | R⁶ | — | — |
| `versao_cruzada` | **C R**⁷ (D em cascata) | R⁶ | — | — |
| `conteudo_versao` (Mongo) | **C R**⁷ (D em cascata) | R⁸ | — | — |
| `sessao_jogo` | R⁹ | **C R U**¹⁰ | — | — |
| `resposta_sessao` | R⁹ (agregado) | **C R**¹¹ | — | — |
| `dica_sessao` | R⁹ (contagem) | **C R**¹² | — | — |

1. Só o próprio usuário (`/auth/eu`). A lista completa existe só na tela de login simulado.
2. Excluir com jogos vira **desativar** (U em `ativa`) — RN15.
3. Só as suas.
4. "Responder" atualiza `status`, `id_admin`, `resposta_admin`, `data_resposta`. Ao aprovar, também **cria** uma `disciplina`.
5. Só as suas (RN03/RN08). D bloqueado se a cruzada já foi jogada (arquivar = U em `status`).
6. Só cruzadas `publicado`, versão atual.
7. Criadas ao criar a cruzada ou ao editar as palavras. **Nunca atualizadas** (RN09).
8. **Sem o campo `resposta`** enquanto a partida está aberta; o gabarito só aparece depois de encerrar (RN11).
9. Só das suas cruzadas, só partidas encerradas (ranking, lista de partidas, painel).
10. Só as suas. U = conferir (tentativas, acertos, erros) e encerrar (fim, tempo, pontuação).
11. C a cada conferência (uma linha por palavra); R no resultado ("suas respostas").

**Ninguém exclui** `usuario`, `sessao_jogo` nem `resposta_sessao` pela aplicação.
Isso preserva o histórico (RN09/RN12).

## Entidade × caso de uso

| UC | usuario | disciplina | solicitação | palavra_cruzada | versao_cruzada | conteudo_versao | sessao_jogo | resposta_sessao | dica_sessao |
|---|---|---|---|---|---|---|---|---|---|
| UC01 Entrar | **C R U** | | | | | | | |
| UC02 Criar cruzadinha | R | R | | **C** | **C** | **C** | | |
| UC03 Gerar grade | | | | | | (monta o C) | | |
| UC04 Editar cruzadinha | R | R | | **R U** | **C R** | **C R** | | |
| UC05 Excluir/arquivar | R | | | **D** ou **U** | D (cascata) | **D** | R (verifica) | |
| UC06 Acompanhar resultados | R | R | | R | R | R | R | R (agregado) |
| UC07 Solicitar disciplina | R | | **C R** | | | | | |
| UC08 Pesquisar jogo | R | R | | R | R | R (sem respostas) | R | |
| UC09 Jogar cruzadinha | R | R | | R | R | R | **C R U** | **C R** | **C R** |
| UC10 Ver progresso e ranking | R | | | R | R | | R | | R (contagem) |
| UC11 Manter disciplina | | **C R U D** | | R (conta jogos) | | | | |
| UC12 Responder solicitação | R | **C** | **R U** | | | | | |

Cada entidade tem pelo menos um caso de uso que a **cria** e um que a **lê**. As
que ninguém atualiza (`versao_cruzada`, `conteudo_versao`, `resposta_sessao`)
são imutáveis de propósito.

## Operação × rota

| Entidade | C | R | U | D |
|---|---|---|---|---|
| `usuario` | `POST /auth/ludica` | `GET /auth/eu`, `GET /auth/usuarios` | `POST /auth/ludica` | — |
| `disciplina` | `POST /disciplinas`, `POST /solicitacoes/:id/responder` | `GET /disciplinas` | `PUT /disciplinas/:id` | `DELETE /disciplinas/:id` |
| `solicitacao_disciplina` | `POST /solicitacoes` | `GET /solicitacoes` | `POST /solicitacoes/:id/responder` | — |
| `palavra_cruzada` | `POST /professor/cruzadas` | `GET /professor/cruzadas[/:id]`, `GET /jogos[/:id]` | `PUT /professor/cruzadas/:id` | `DELETE /professor/cruzadas/:id` |
| `versao_cruzada` + `conteudo_versao` | `POST` / `PUT /professor/cruzadas[/:id]` | os mesmos `GET` acima, `GET /sessoes/:id` | — | junto com a cruzada |
| `sessao_jogo` | `POST /jogos/:id/sessoes` | `GET /sessoes/:id`, `GET /jogos/:id` | `POST /sessoes/:id/conferir`, `POST /sessoes/:id/encerrar` | — |
| `resposta_sessao` | `POST /sessoes/:id/conferir` | `GET /sessoes/:id` (encerrada) | — | — |
| `dica_sessao` | `POST /sessoes/:id/dica` | `GET /sessoes/:id`, ranking e partidas (contagem) | — | — |
