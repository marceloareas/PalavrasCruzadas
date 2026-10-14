# Histórico das sprints e decisões

O que cada sprint pediu, como foi atendido e as decisões tomadas no caminho.
Quando uma sprint contradiz a anterior, **vale a mais recente**. O documento
inicial (`Jogo de Palavras Cruzadas … (CEFET-RJ).docx`, v1) é guia, não regra.

## Sprint 1

| Atividade | Como ficou |
|---|---|
| Enviar ao professor os usuários que faltam no repositório | Feito fora do código |
| README com descrição do sistema e branches dev/homolog | `README.md`; branches `dev` e `homolog` criadas |
| Modelo lógico do BD | Primeira versão (diagrama ER) → evoluiu, ver [modelo-de-dados.md](modelo-de-dados.md) |
| Linguagem e tecnologias | Definidas na Sprint 2 e revistas na 3 |
| Protótipo visual | [Stitch](https://stitch.withgoogle.com/preview/16078468215582123359?node-id=4d667055dbf543698dd5764bad11e7f4); a paleta foi usada no front |
| RNs v1 e diagrama de caso de uso | Documento inicial → atualizado em [regras-e-casos-de-uso.md](regras-e-casos-de-uso.md) |
| Projeto em Docker | `docker-compose.yml` |

## Sprint 2

| Atividade | Como ficou |
|---|---|
| Alterações no modelo de BD | Removida `senha`; entraram `id_ludica` e `usertag` (o Lúdica autentica e envia `id, usertag, email, papel`); `codigo_acesso`; versões (RN09) |
| Linguagem e tecnologias | Node + Express, EJS, PostgreSQL |
| Usuários professor e aluno no banco | Seed com 2 professores e 3 alunos no formato do Lúdica |
| Professor cadastra uma cruzada e persiste | Entrega 1 (branch `feature/criacao-jogo-professor`): CRUD com versionamento; o professor informava linha/coluna/direção |

## Sprint 3 (a que vale)

| Atividade | Como ficou |
|---|---|
| Alterações no modelo de BD | Ver tabela "o que mudou" em [modelo-de-dados.md](modelo-de-dados.md#o-que-mudou-em-relação-ao-diagrama-anterior) |
| Modelos PostgreSQL **e** MongoDB | Postgres relacional + coleção `conteudo_versao` no Mongo |
| Front em React; back Node ou Python | React + Vite; **back-end mantido em Node** (precisa ser informado ao professor) |
| Perfil administrador — Manter Disciplina | Telas e rotas do admin (RN15) |
| Range mínimo/máximo de palavras | **5 a 15** (RN13) |
| Professor só cadastra respostas e dicas; sistema gera a matriz | Gerador automático (RN14) — [gerador-de-grade.md](gerador-de-grade.md) |
| Iniciar a parte do aluno: pesquisar jogo | Busca por texto, código, disciplina e dificuldade (RN17) |
| Futuro: professor solicita disciplina → admin | Já implementado (RN16) |

## Além da Sprint 3

| Item | Como ficou |
|---|---|
| Aluno jogar | Preenche a grade toda e confere; o sistema diz só quantas palavras estão certas (RN18) — [jogo-e-pontuacao.md](jogo-e-pontuacao.md) |
| Pontuação | Pela tentativa do acerto, dificuldade, tempo e grade completa (RN19) |
| Ranking e resultados | Ranking por cruzada; partidas dos alunos na tela do professor |

## Registro de decisões

| # | Decisão | Por quê | Situação |
|---|---|---|---|
| D1 | Back-end em **Node + Express** | Já estava em Node; menos retrabalho | Informar na reunião |
| D2 | **Palavras e grade no MongoDB**, resto no Postgres | A versão é imutável e lida inteira, e a Sprint 3 pede os dois bancos. O argumento é o formato do dado, **não** o volume (15 palavras × N jogos é pouco para o Postgres) | Validar com o professor |
| D3 | `resposta_sessao` aponta para `indice_palavra` em vez de FK para `palavra` | A palavra mora no Mongo; como a versão é imutável, o índice não fica inválido | — |
| D4 | Limite de **5 a 15** palavras | Abaixo de 5 quase não há cruzamento; acima de 15 a grade fica grande demais | Validar com o professor |
| D5 | **RN04 vence a RN02**: uma disciplina por cruzada | A v1 dizia "uma ou mais" na RN02 e "apenas uma" na RN04 | — |
| D6 | Login **simulado** até definir a integração com o Lúdica | O sistema vai rodar dentro do Lúdica, mas ainda não se sabe como | Pendente (ponto único de troca: `middleware/auth.js`) |
| D7 | Disciplina com jogos é **desativada**, não apagada | As cruzadas existentes continuam apontando para ela | — |
| D8 | Cruzada já jogada **não pode ser excluída**, só arquivada | Excluir apagaria o histórico dos alunos (RN09/RN12) | Validar com o grupo |
| D9 | Editar só título/descrição/status **não cria versão** | Versão nova só quando as palavras mudam | Validar com o grupo |
| D10 | Só o **autor** vê o gabarito | Nem outro professor deve ver as respostas (RN11) | Validar com o grupo |
| D11 | Jogo: **preenche tudo e confere**, recebendo só a contagem | Decisão do grupo | ✔ |
| D12 | Palavra só vale pela tentativa em que **ficou certa até o fim** | Senão dava para trocar palavras certas por erradas sem perder nada | Validar com o grupo |
| D13 | **Sem limite** de conferências | O fator por tentativa já desestimula o chute | Validar com o grupo |
| D14 | Valores da pontuação (100/70/50/30, ×1/1,2/1,5, +20% tempo, +10% completa) | Proposta inicial, fácil de ajustar em `regras.js` | Validar com o grupo |
| D15 | Ranking com a **melhor** partida de cada aluno, desempate por tempo | — | Validar com o grupo |
| D16 | Tempo medido pelo **servidor** | O cronômetro do navegador pode ser manipulado | — |

## Pendências

- Integração real com o Lúdica (autenticação, e possivelmente envio de resultados).
- Validar as decisões marcadas acima com o grupo e o professor.
- Definir "outros fatores" da pontuação (ideias em [jogo-e-pontuacao.md](jogo-e-pontuacao.md#ideias-ainda-não-implementadas-outros-fatores)).
- Ambientes de homologação e produção (hoje só existe o compose de desenvolvimento).
- Atualizar o relatório semanal do documento da disciplina (feitos / próxima semana / dificuldades).

## Branches

Situação em 14/10/2026:

| Branch | Conteúdo |
|---|---|
| `main` | README inicial + documento da disciplina |
| `dev` | **Tudo até aqui**: entrega 1, Sprint 3, jogo do aluno e esta documentação |
| `homolog` | Entrega 1 (Sprint 2). Promover a `dev` depois de validar as decisões com o professor |
| `feature/criacao-jogo-professor` | Entrega 1 (Sprint 2) — PR #1, integrada |
| `feature/sprint-3` | Sprint 3 — PR #2, integrada |
| `feature/jogo-aluno` | Jogo do aluno, pontuação, ranking e documentação — integrada |
