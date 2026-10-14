# Diagramas

Diagramas de domínio, estados e sequência. A estrutura dos bancos está em
[dicionario-de-dados.md](dicionario-de-dados.md) e
[modelo-de-dados.md](modelo-de-dados.md); a arquitetura (serviços e camadas),
em [arquitetura.md](arquitetura.md); o diagrama de casos de uso, em
[casos-de-uso.md](casos-de-uso.md).

## 1. Modelo de domínio (classes)

Conceitos do negócio e como se relacionam, independente de qual banco guarda cada um.

```mermaid
classDiagram
    direction LR
    class Usuario {
        idLudica
        usertag
        nome
        email
        papel: professor/aluno/administrador
    }
    class Disciplina {
        nome
        codigo
        ativa
    }
    class SolicitacaoDisciplina {
        nome
        codigoSugerido
        justificativa
        status: pendente/aprovada/recusada
        respostaAdmin
    }
    class PalavraCruzada {
        titulo
        descricao
        codigoAcesso
        dificuldade: facil/medio/dificil
        status: rascunho/publicado/arquivado
    }
    class Versao {
        numero
        linhas
        colunas
    }
    class Palavra {
        indice
        numero
        resposta
        dica
        linha
        coluna
        direcao
    }
    class Partida {
        inicio
        fim
        tempo
        tentativas
        acertos
        erros
        pontuacao
    }
    class RespostaEnviada {
        numeroTentativa
        respostaInformada
        correta
    }
    class LetraRevelada {
        linha
        coluna
        letra
    }

    Usuario "1" --> "*" PalavraCruzada : autor
    Usuario "1" --> "*" Partida : aluno
    Usuario "1" --> "*" SolicitacaoDisciplina : solicita
    Disciplina "1" <-- "*" PalavraCruzada : pertence (RN04)
    SolicitacaoDisciplina "0..1" --> "0..1" Disciplina : cria
    PalavraCruzada "1" *-- "1..*" Versao : versões (RN09)
    Versao "1" *-- "5..15" Palavra : (RN13)
    Versao "1" <-- "*" Partida : jogada em
    Partida "1" *-- "*" RespostaEnviada
    Partida "1" *-- "0..3" LetraRevelada : dicas (RN20)
    RespostaEnviada "*" --> "1" Palavra : indice
```

`Versao` + `Palavra` = `versao_cruzada` (Postgres) + `conteudo_versao` (Mongo).
`Partida` = `sessao_jogo`; `RespostaEnviada` = `resposta_sessao`; `LetraRevelada` = `dica_sessao`.

---

## 2. Diagramas de estado

### Cruzadinha (`palavra_cruzada.status`)

```mermaid
stateDiagram-v2
    [*] --> rascunho: criar (padrão)
    [*] --> publicado: criar já publicada
    rascunho --> publicado: editar status
    publicado --> rascunho: editar status
    publicado --> arquivado: editar status
    rascunho --> arquivado: editar status
    arquivado --> publicado: editar status
    rascunho --> [*]: excluir (sem partidas)
    publicado --> [*]: excluir (sem partidas)
    arquivado --> [*]: excluir (sem partidas)
    note right of publicado: só neste estado aparece para o aluno (RN17)
    note right of arquivado: destino de cruzadas já jogadas, no lugar de excluir
```

### Partida (`sessao_jogo`)

```mermaid
stateDiagram-v2
    [*] --> EmAndamento: Jogar (fim = NULL)
    EmAndamento --> EmAndamento: conferir com palavras erradas
    EmAndamento --> Concluida: conferir com todas certas
    EmAndamento --> Encerrada: Encerrar partida
    Concluida --> [*]
    Encerrada --> [*]
    note right of EmAndamento: sem gabarito (RN11), retomável
    note right of Concluida: fim, tempo e pontuação gravados, com bônus de tempo e de completar
    note right of Encerrada: pontua o que estava certo na última conferência, sem bônus
```

No banco, "Concluída" e "Encerrada" são o mesmo estado (`fim` preenchido). A
diferença é se `acertos = qtd_palavras`.

### Solicitação de disciplina

```mermaid
stateDiagram-v2
    [*] --> pendente: professor solicita
    pendente --> aprovada: admin aprova (cria a disciplina)
    pendente --> recusada: admin recusa
    aprovada --> [*]
    recusada --> [*]
```

### Disciplina

```mermaid
stateDiagram-v2
    [*] --> ativa: admin cria / aprovação de solicitação
    ativa --> inativa: desativar, ou excluir com jogos
    inativa --> ativa: reativar
    ativa --> [*]: excluir sem jogos
    inativa --> [*]: excluir sem jogos
```

---

## 3. Diagramas de sequência

### UC02 — Criar cruzadinha (com geração da grade)

```mermaid
sequenceDiagram
    actor P as Professor
    participant W as React (FormCruzada)
    participant A as API (routes/cruzadas)
    participant S as cruzadaService
    participant G as gerador
    participant PG as PostgreSQL
    participant M as MongoDB

    P->>W: preenche dados + 5..15 respostas/dicas, Salvar
    W->>A: POST /api/professor/cruzadas
    A->>A: exigirPapel('professor')
    A->>S: criarCruzada(idAutor, dados)
    S->>PG: disciplina existe e está ativa?
    S->>G: validarPalavras()
    G-->>S: erros? (5..15, dica, repetida...)
    S->>G: gerarGrade()
    G-->>S: palavras com linha/coluna/direção/número
    alt alguma palavra não encaixou
        S-->>A: 422 "Não foi possível encaixar: ..."
        A-->>W: erro
        W-->>P: lista de erros no formulário
    else ok
        S->>PG: BEGIN
        S->>PG: INSERT palavra_cruzada (código de acesso)
        S->>PG: INSERT versao_cruzada (v1)
        S->>M: insertOne(conteudo_versao)
        S->>PG: COMMIT
        S-->>A: { idCruzada, idVersao }
        A-->>W: 201
        W-->>P: detalhe com a grade gerada
    end
```

### UC04 — Editar cruzadinha

```mermaid
sequenceDiagram
    actor P as Professor
    participant A as API
    participant S as cruzadaService
    participant PG as PostgreSQL
    participant M as MongoDB

    P->>A: PUT /api/professor/cruzadas/:id
    A->>S: editarCruzada()
    S->>PG: cruzada é do professor? (senão 403)
    S->>M: conteúdo da versão atual
    alt palavras iguais
        S->>PG: UPDATE palavra_cruzada (cabeçalho)
        S-->>P: novaVersao: false
    else palavras mudaram
        S->>S: gerarGrade()
        S->>PG: BEGIN, UPDATE cabeçalho, INSERT versao_cruzada (n+1)
        S->>M: insertOne(conteudo_versao)
        S->>PG: COMMIT
        S-->>P: novaVersao: true (partidas antigas ficam na versão n)
    end
```

### UC09 — Jogar cruzadinha

```mermaid
sequenceDiagram
    actor Al as Aluno
    participant W as React (Jogar)
    participant A as API
    participant SS as sessaoService
    participant PT as pontuacao
    participant PG as PostgreSQL
    participant M as MongoDB

    Al->>W: Jogar
    W->>A: POST /api/jogos/:id/sessoes
    A->>SS: iniciarSessao()
    SS->>PG: partida aberta nesta versão?
    alt existe
        SS-->>W: { id_sessao, retomada: true }
    else
        SS->>PG: INSERT sessao_jogo
        SS-->>W: { id_sessao }
    end
    W->>A: GET /api/sessoes/:id
    A->>SS: obterSessao()
    SS->>M: conteúdo da versão
    SS-->>W: grade vazia + dicas (sem respostas)

    loop até completar ou encerrar
        Al->>W: preenche e Conferir
        W->>A: POST /api/sessoes/:id/conferir { respostas }
        A->>SS: conferir()
        SS->>PG: BEGIN, SELECT sessão FOR UPDATE
        SS->>M: respostas certas
        SS->>PG: INSERT resposta_sessao (1 por palavra)
        SS->>PG: UPDATE tentativas, acertos, erros
        opt todas certas
            SS->>PG: histórico de respostas
            SS->>PT: calcularPontuacao()
            SS->>PG: UPDATE fim, tempo, pontuacao
        end
        SS->>PG: COMMIT
        SS-->>W: { tentativa, certas, total, concluida }
        W-->>Al: "X de N palavras certas"
    end

    W->>A: GET /api/sessoes/:id
    A-->>W: pontuação detalhada + gabarito
    W-->>Al: resultado
```

### UC12 — Responder solicitação de disciplina

```mermaid
sequenceDiagram
    actor Ad as Administrador
    participant A as API
    participant D as disciplinaService
    participant PG as PostgreSQL

    Ad->>A: POST /api/solicitacoes/:id/responder { aprovar, nome, codigo }
    A->>D: responderSolicitacao()
    D->>PG: BEGIN, SELECT solicitação FOR UPDATE
    alt já respondida
        D-->>Ad: 409
    else aprovar
        D->>PG: INSERT disciplina
        alt código repetido
            D->>PG: ROLLBACK
            D-->>Ad: 409
        else
            D->>PG: UPDATE solicitação (aprovada, id_disciplina)
            D->>PG: COMMIT
            D-->>Ad: aprovada
        end
    else recusar
        D->>PG: UPDATE solicitação (recusada), COMMIT
        D-->>Ad: recusada
    end
```

---

## 4. Navegação entre telas

```mermaid
flowchart TD
    L["/login"] -->|professor| PP["/professor<br/>Painel"]
    L -->|aluno| AJ["/jogos<br/>Buscar jogos"]
    L -->|administrador| AD["/admin/disciplinas"]

    PP --> PN["/professor/nova"]
    PP --> PD["/professor/cruzadas/:id<br/>gabarito, ranking, partidas"]
    PN -->|salvar| PD
    PD --> PE["/professor/cruzadas/:id/editar"]
    PE -->|salvar| PD
    PP --> PS["/professor/solicitacoes"]

    AJ --> JD["/jogos/:id<br/>tabuleiro, ranking, minhas partidas"]
    JD -->|Jogar / Continuar| JP["/partida/:id"]
    JP -->|completa ou encerra| JR["/partida/:id<br/>resultado + gabarito"]
    JR -->|Jogar de novo| JP
    JR -->|Ver ranking| JD

    AD <--> AS["/admin/solicitacoes"]
```
