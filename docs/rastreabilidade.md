# Matriz de rastreabilidade

Para cada regra de negócio: em quais casos de uso ela aparece e onde é
garantida (banco, API, tela) e testada.

- Texto das regras: [regras-e-casos-de-uso.md](regras-e-casos-de-uso.md)
- Casos de uso: [casos-de-uso.md](casos-de-uso.md)
- **Teste unitário** = `npm test` em `backend/` (`gerador.test.js`, `pontuacao.test.js`).
- **Ponta a ponta** = verificado pela API e pelo navegador com os scripts usados no desenvolvimento.

Caminhos: `svc/` = `backend/src/services/`, `rotas/` = `backend/src/routes/`, `pág/` = `frontend/src/paginas/`.

| RN | Resumo | UC | Banco | API | Tela | Teste |
|---|---|---|---|---|---|---|
| RN01 | Papel único: professor, aluno ou administrador | UC01 | `CHECK usuario.papel` | `svc/usuarioService` valida o payload; `middleware/auth.js` (`exigirPapel`) | `<Protegida papeis>` em `main.jsx`; menu por papel | ponta a ponta (payload inválido → 422; aluno em rota de professor → 403) |
| RN02 | Só professor cria cruzada e associa disciplina | UC02 | — | `rotas/cruzadas.js`: `exigirPapel('professor')` | menu "Novo jogo" só para professor | ponta a ponta (403) |
| RN03 | Só o autor edita/exclui | UC04, UC05 | `palavra_cruzada.id_autor` | `svc/cruzadaService` → `obterDoAutor` | botões só no detalhe do autor | ponta a ponta (outro professor → 403) |
| RN04 | Uma disciplina por cruzada | UC02, UC04 | FK `id_disciplina NOT NULL` | `prepararDados` exige uma disciplina ativa | um `<select>` de disciplina | ponta a ponta |
| RN05 | Cruzada = palavras + dicas | UC02 | `conteudo_versao.palavras[]` (Mongo) | `validarPalavras` (dica obrigatória) | lista resposta + dica | unitário (dica vazia) |
| RN06 | A grade é verificada ao salvar | UC02, UC03, UC04 | — | `gerarOuRecusar` → 422 "Não foi possível encaixar" | erros no topo do formulário | unitário (palavra sem letra em comum) + ponta a ponta |
| RN07 | Dificuldade fácil/médio/difícil | UC02 | `CHECK palavra_cruzada.dificuldade` | `prepararDados`; multiplicador em `PONTUACAO` | `<select>`, pílula, filtro da busca | unitário (multiplicador) |
| RN08 | Só o autor edita | UC04 | — | igual à RN03 | — | ponta a ponta |
| RN09 | Editar não apaga o histórico; partida fica na versão jogada | UC04, UC05, UC09 | `versao_cruzada` + `UNIQUE (id_cruzada, numero_versao)`; `sessao_jogo.id_versao` sem cascade | `editarCruzada` cria versão n+1; `excluirCruzada` bloqueia se jogada (409) | histórico de versões; aviso "Nova versão vN" | ponta a ponta |
| RN10 | Jogar a mesma cruzada várias vezes | UC09 | várias `sessao_jogo` por aluno/versão | `iniciarSessao` (retoma a aberta ou cria nova) | "Jogar", "Continuar partida", "Jogar de novo" | ponta a ponta |
| RN11 | Respostas escondidas até tentar | UC08, UC09, UC06 | — | `montarTabuleiro` (sem `resposta`); `obterSessao` só manda gabarito encerrada; detalhe com gabarito só para o autor | tabuleiro vazio; gabarito só no resultado | unitário (matriz do aluno sem letras) + ponta a ponta (partida aberta sem respostas; conferir não diz quais) |
| RN12 | Registrar tempo, tentativas, acertos/erros | UC09, UC06 | colunas de `sessao_jogo` + `resposta_sessao` | `conferir`, `finalizar` (tempo pelo Postgres) | resultado; partidas do professor | ponta a ponta |
| RN13 | 5 a 15 palavras | UC02, UC04 | `CHECK qtd_palavras BETWEEN 5 AND 15`; `$jsonSchema` `minItems/maxItems` | `validarPalavras`; `GET /regras` | contador "N / 15 (mínimo 5)" | unitário (4 e 16 recusadas) |
| RN14 | Sistema gera a grade | UC03 | `versao_cruzada.linhas/colunas`; posições no Mongo | `svc/gerador.js` (`gerarGrade`) | formulário só com resposta + dica | unitário (sem conflito, sem sequência acidental, determinismo, 15 palavras) |
| RN15 | Admin mantém disciplinas; com jogos, desativa | UC11 | `disciplina.ativa` | `rotas/disciplinas.js` (`exigirPapel('administrador')`); `excluirDisciplina` | `pág/admin/Disciplinas.jsx` | ponta a ponta |
| RN16 | Professor solicita, admin aprova/recusa | UC07, UC12 | `solicitacao_disciplina` | `solicitarDisciplina`, `responderSolicitacao` (transação; 409 se já respondida) | `pág/professor/SolicitarDisciplina.jsx`, `pág/admin/Solicitacoes.jsx` | ponta a ponta |
| RN17 | Aluno só encontra jogos publicados | UC08 | `idx_palavra_cruzada_status` | `buscarJogos` (`status = 'publicado'`); `obterJogoParaAluno`/`iniciarSessao` → 404 | `pág/aluno/BuscarJogos.jsx` | ponta a ponta (rascunho → 404) |
| RN18 | Preenche tudo e confere; só a contagem | UC09 | `resposta_sessao` por tentativa | `conferir` devolve `{ tentativa, certas, total, concluida }` | `pág/aluno/Jogar.jsx` | ponta a ponta |
| RN19 | Pontuação por tentativa, dificuldade, tempo e grade completa | UC09, UC10 | `sessao_jogo.pontuacao` | `svc/pontuacao.js` + `PONTUACAO` em `regras.js` | detalhamento no resultado; ranking | unitário (5 testes) + ponta a ponta |

## Cobertura por caso de uso

| UC | RNs |
|---|---|
| UC01 Entrar no sistema | RN01 |
| UC02 Criar cruzadinha | RN02, RN04, RN05, RN06, RN07, RN13, RN14 |
| UC03 Gerar grade | RN06, RN14 |
| UC04 Editar cruzadinha | RN03, RN04, RN06, RN08, RN09, RN13 |
| UC05 Excluir/arquivar | RN03, RN09 |
| UC06 Acompanhar resultados | RN11, RN12 |
| UC07 Solicitar disciplina | RN16 |
| UC08 Pesquisar jogo | RN11, RN17 |
| UC09 Jogar cruzadinha | RN09, RN10, RN11, RN12, RN18, RN19 |
| UC10 Ver progresso e ranking | RN12, RN19 |
| UC11 Manter disciplina | RN15 |
| UC12 Responder solicitação | RN16 |

Toda RN aparece em pelo menos um caso de uso, e todo caso de uso tem pelo menos uma RN.

## Onde ainda não há teste automatizado

As regras que dependem de banco (permissões, versões, partida) foram
verificadas ponta a ponta durante o desenvolvimento, mas **não** têm teste
automatizado no repositório. Um próximo passo seria criar testes de integração
da API (por exemplo com `node:test` + um Postgres/Mongo de teste no Docker).
