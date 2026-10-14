-- ============================================================================
-- Jogo de Palavras Cruzadas - Ciencia da Computacao (CEFET-RJ)
-- Modelo relacional (PostgreSQL) - Sprint 3
--
-- Divisao entre os bancos:
--   PostgreSQL -> quem, quando e quanto: usuarios, disciplinas, solicitacoes,
--                 cruzadas, versoes, sessoes de jogo e respostas (ranking).
--   MongoDB    -> o conteudo do jogo: as palavras (resposta + dica) e a grade
--                 gerada de cada versao, 1 documento por versao
--                 (colecao `conteudo_versao`, ver db/mongo/modelo.md).
--
-- Como uma versao nunca e alterada depois de criada (RN09), o documento no
-- Mongo tambem e imutavel; a ligacao entre os bancos e o `id_versao`.
--
-- Usuarios vem do Ludica (provedor de identidade), que envia:
--   id, usertag, email, papel   -> por isso nao ha coluna de senha.
-- ============================================================================

DROP TABLE IF EXISTS resposta_sessao        CASCADE;
DROP TABLE IF EXISTS sessao_jogo            CASCADE;
DROP TABLE IF EXISTS versao_cruzada         CASCADE;
DROP TABLE IF EXISTS palavra_cruzada        CASCADE;
DROP TABLE IF EXISTS solicitacao_disciplina CASCADE;
DROP TABLE IF EXISTS disciplina             CASCADE;
DROP TABLE IF EXISTS usuario                CASCADE;

-- ---------------------------------------------------------------------------
-- usuario
-- RN01 - Todo usuario possui um papel unico: professor, aluno ou administrador.
-- ---------------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario    SERIAL       PRIMARY KEY,
    id_ludica     INTEGER      NOT NULL UNIQUE,          -- id externo (Ludica)
    usertag       VARCHAR(50)  NOT NULL UNIQUE,          -- handle no Ludica
    nome          VARCHAR(100),
    email         VARCHAR(150) NOT NULL UNIQUE,
    papel         VARCHAR(20)  NOT NULL
                  CHECK (papel IN ('professor', 'aluno', 'administrador')),
    data_cadastro TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- disciplina  (mantida pelo administrador - "Manter Disciplina")
-- RN15 - Disciplina com cruzadas nao e apagada, apenas desativada (`ativa`);
--        disciplinas inativas nao aparecem para novos jogos.
-- ---------------------------------------------------------------------------
CREATE TABLE disciplina (
    id_disciplina SERIAL       PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    codigo        VARCHAR(20)  NOT NULL UNIQUE,
    ativa         BOOLEAN      NOT NULL DEFAULT TRUE,
    data_criacao  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- solicitacao_disciplina
-- RN16 - O professor solicita uma disciplina nova; o administrador aprova
--        (a disciplina e criada) ou recusa.
-- ---------------------------------------------------------------------------
CREATE TABLE solicitacao_disciplina (
    id_solicitacao  SERIAL       PRIMARY KEY,
    id_professor    INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    nome            VARCHAR(100) NOT NULL,
    codigo_sugerido VARCHAR(20),
    justificativa   TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'aprovada', 'recusada')),
    id_admin        INTEGER      REFERENCES usuario(id_usuario),
    id_disciplina   INTEGER      REFERENCES disciplina(id_disciplina), -- criada na aprovacao
    resposta_admin  TEXT,
    data_solicitacao TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_resposta   TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- palavra_cruzada  (cabecalho / metadados da cruzada)
-- RN02 - Apenas professores criam cruzadas e as associam a disciplina.
-- RN03/RN08 - Apenas o professor autor edita/exclui.
-- RN04 - Uma cruzada pertence a APENAS UMA disciplina (FK simples).
-- RN07 - Nivel de dificuldade: facil | medio | dificil.
-- Somente cruzadas 'publicado' aparecem na busca do aluno.
-- ---------------------------------------------------------------------------
CREATE TABLE palavra_cruzada (
    id_cruzada       SERIAL       PRIMARY KEY,
    id_autor         INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    id_disciplina    INTEGER      NOT NULL REFERENCES disciplina(id_disciplina),
    titulo           VARCHAR(150) NOT NULL,
    codigo_acesso    VARCHAR(20)  NOT NULL UNIQUE,  -- ex.: ES-48291
    descricao        TEXT,
    dificuldade      VARCHAR(20)  NOT NULL DEFAULT 'facil'
                     CHECK (dificuldade IN ('facil', 'medio', 'dificil')),
    status           VARCHAR(20)  NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
    data_criacao     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- versao_cruzada  (historico de versoes - o conteudo fica no MongoDB)
-- RN09 - Editar as palavras cria uma nova versao; sessoes antigas continuam
--        apontando para a versao jogada.
-- RN13 - Um jogo tem de 5 a 15 palavras (garantido tambem pelo CHECK).
-- RN14 - linhas/colunas sao as dimensoes da grade gerada pelo sistema.
-- ---------------------------------------------------------------------------
CREATE TABLE versao_cruzada (
    id_versao     SERIAL    PRIMARY KEY,
    id_cruzada    INTEGER   NOT NULL REFERENCES palavra_cruzada(id_cruzada)
                            ON DELETE CASCADE,
    numero_versao INTEGER   NOT NULL,
    qtd_palavras  INTEGER   NOT NULL CHECK (qtd_palavras BETWEEN 5 AND 15),
    linhas        INTEGER   NOT NULL CHECK (linhas  >= 1),
    colunas       INTEGER   NOT NULL CHECK (colunas >= 1),
    data_criacao  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_cruzada, numero_versao)
);

-- ---------------------------------------------------------------------------
-- sessao_jogo  (uma partida de um aluno sobre uma versao especifica)
-- RN10 - Um aluno pode jogar a mesma cruzada multiplas vezes.
-- RN12 - Registra tempo, tentativas, acertos/erros e pontuacao (ranking).
--        `tempo` e `tentativas` ficam gravados (em vez de calculados) para
--        o ranking nao precisar recalcular a cada consulta.
-- ---------------------------------------------------------------------------
CREATE TABLE sessao_jogo (
    id_sessao  SERIAL       PRIMARY KEY,
    id_versao  INTEGER      NOT NULL REFERENCES versao_cruzada(id_versao),
    id_aluno   INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    inicio     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim        TIMESTAMP,
    tempo      INTEGER      NOT NULL DEFAULT 0,   -- segundos
    tentativas INTEGER      NOT NULL DEFAULT 0,
    acertos    INTEGER      NOT NULL DEFAULT 0,
    erros      INTEGER      NOT NULL DEFAULT 0,
    pontuacao  NUMERIC(7,2) NOT NULL DEFAULT 0.00
);

-- ---------------------------------------------------------------------------
-- resposta_sessao  (cada tentativa do aluno para uma palavra)
-- A palavra e identificada por `indice_palavra` (1..15) dentro da versao da
-- sessao; como a versao e imutavel, o indice nunca fica invalido.
-- ---------------------------------------------------------------------------
CREATE TABLE resposta_sessao (
    id_resposta        SERIAL       PRIMARY KEY,
    id_sessao          INTEGER      NOT NULL REFERENCES sessao_jogo(id_sessao)
                                    ON DELETE CASCADE,
    indice_palavra     INTEGER      NOT NULL CHECK (indice_palavra BETWEEN 1 AND 15),
    resposta_informada VARCHAR(100) NOT NULL,
    correta            BOOLEAN      NOT NULL,
    numero_tentativa   INTEGER      NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
CREATE INDEX idx_palavra_cruzada_autor      ON palavra_cruzada (id_autor);
CREATE INDEX idx_palavra_cruzada_disciplina ON palavra_cruzada (id_disciplina);
CREATE INDEX idx_palavra_cruzada_status     ON palavra_cruzada (status);
CREATE INDEX idx_versao_cruzada_cruzada     ON versao_cruzada  (id_cruzada);
CREATE INDEX idx_sessao_aluno_versao        ON sessao_jogo     (id_aluno, id_versao, inicio);
CREATE INDEX idx_resposta_sessao_sessao     ON resposta_sessao (id_sessao, indice_palavra);
CREATE INDEX idx_solicitacao_status         ON solicitacao_disciplina (status);
