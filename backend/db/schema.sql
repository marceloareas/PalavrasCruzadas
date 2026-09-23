-- ============================================================================
-- Jogo de Palavras Cruzadas - Ciencia da Computacao (CEFET-RJ)
-- Esquema do banco de dados (PostgreSQL)
--
-- Baseado no modelo de dados aprovado (ver diagrama ER) e nas regras de
-- negocio RN01..RN12 do documento inicial (v1).
--
-- Adaptacao para integracao com o "Ludica":
--   O Ludica e o provedor de identidade/autenticacao. Ele envia os campos:
--       id, usertag, email, papel
--   Por isso a tabela `usuario`:
--     - guarda `id_ludica`  -> o `id` externo enviado pelo Ludica (chave de
--       sincronizacao / upsert);
--     - guarda `usertag`    -> handle do usuario no Ludica;
--     - NAO guarda `senha`  -> a autenticacao e responsabilidade do Ludica.
-- ============================================================================

-- Recria o schema do zero (idempotente para ambiente de desenvolvimento).
DROP TABLE IF EXISTS resposta_sessao CASCADE;
DROP TABLE IF EXISTS sessao_jogo      CASCADE;
DROP TABLE IF EXISTS palavra           CASCADE;
DROP TABLE IF EXISTS versao_cruzada    CASCADE;
DROP TABLE IF EXISTS palavra_cruzada   CASCADE;
DROP TABLE IF EXISTS disciplina        CASCADE;
DROP TABLE IF EXISTS usuario           CASCADE;

-- ---------------------------------------------------------------------------
-- usuario  (professores e alunos)
-- RN01 - Todo usuario possui um papel unico: professor ou aluno.
-- ---------------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario    SERIAL       PRIMARY KEY,
    id_ludica     INTEGER      NOT NULL UNIQUE,          -- id externo (Ludica)
    usertag       VARCHAR(50)  NOT NULL UNIQUE,          -- handle no Ludica
    nome          VARCHAR(100),                          -- opcional (default = usertag)
    email         VARCHAR(150) NOT NULL UNIQUE,
    papel         VARCHAR(20)  NOT NULL
                  CHECK (papel IN ('professor', 'aluno')),
    data_cadastro TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- disciplina  (materias de Ciencia da Computacao)
-- ---------------------------------------------------------------------------
CREATE TABLE disciplina (
    id_disciplina SERIAL      PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    codigo        VARCHAR(20)  NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- palavra_cruzada  (cabecalho / metadados da cruzada)
-- RN02 - Apenas professores criam/associam cruzadas a disciplinas.
-- RN03/RN08 - Apenas o professor autor edita/exclui.
-- RN04 - Uma cruzada pertence a APENAS UMA disciplina (FK simples).
-- RN07 - Nivel de dificuldade: facil | medio | dificil.
-- ---------------------------------------------------------------------------
CREATE TABLE palavra_cruzada (
    id_cruzada      SERIAL      PRIMARY KEY,
    id_autor        INTEGER     NOT NULL REFERENCES usuario(id_usuario),
    id_disciplina   INTEGER     NOT NULL REFERENCES disciplina(id_disciplina),
    titulo          VARCHAR(150) NOT NULL,
    codigo_acesso   VARCHAR(20)  UNIQUE,   -- codigo da turma/desafio (ex.: CSD-48291)
    descricao       TEXT,
    dificuldade     VARCHAR(20)  NOT NULL DEFAULT 'facil'
                    CHECK (dificuldade IN ('facil', 'medio', 'dificil')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
    data_criacao    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- versao_cruzada  (historico de versoes de uma cruzada)
-- RN09 - Editar uma cruzada que ja possui tentativas de alunos NAO apaga o
--        historico; cada tentativa fica vinculada a versao jogada naquele
--        momento. Por isso as palavras e as sessoes de jogo apontam para a
--        VERSAO, e nunca diretamente para a cruzada.
-- ---------------------------------------------------------------------------
CREATE TABLE versao_cruzada (
    id_versao     SERIAL     PRIMARY KEY,
    id_cruzada    INTEGER    NOT NULL REFERENCES palavra_cruzada(id_cruzada)
                             ON DELETE CASCADE,
    numero_versao INTEGER    NOT NULL,
    data_criacao  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_cruzada, numero_versao)
);

-- ---------------------------------------------------------------------------
-- palavra  (respostas + dicas + posicao na grade)
-- RN05 - Uma cruzada e composta por um conjunto de palavras (respostas) e
--        suas respectivas dicas.
-- direcao: horizontal | vertical.  (linha, coluna) sao 1-indexados.
-- ---------------------------------------------------------------------------
CREATE TABLE palavra (
    id_palavra SERIAL       PRIMARY KEY,
    id_versao  INTEGER      NOT NULL REFERENCES versao_cruzada(id_versao)
                            ON DELETE CASCADE,
    resposta   VARCHAR(100) NOT NULL,
    dica       TEXT         NOT NULL,
    linha      INTEGER      NOT NULL CHECK (linha  >= 1),
    coluna     INTEGER      NOT NULL CHECK (coluna >= 1),
    direcao    VARCHAR(10)  NOT NULL
               CHECK (direcao IN ('horizontal', 'vertical'))
);

-- ---------------------------------------------------------------------------
-- sessao_jogo  (uma partida de um aluno sobre uma versao especifica)
-- RN10 - Um aluno pode jogar a mesma cruzada multiplas vezes (varias sessoes).
-- RN12 - Registra tempo, tentativas, acertos/erros e pontuacao (ranking).
-- ---------------------------------------------------------------------------
CREATE TABLE sessao_jogo (
    id_sessao  SERIAL      PRIMARY KEY,
    id_versao  INTEGER     NOT NULL REFERENCES versao_cruzada(id_versao),
    id_aluno   INTEGER     NOT NULL REFERENCES usuario(id_usuario),
    inicio     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim        TIMESTAMP,
    tempo      INTEGER     NOT NULL DEFAULT 0,   -- segundos
    tentativas INTEGER     NOT NULL DEFAULT 0,
    acertos    INTEGER     NOT NULL DEFAULT 0,
    erros      INTEGER     NOT NULL DEFAULT 0,
    pontuacao  NUMERIC(5,2) NOT NULL DEFAULT 0.00
);

-- ---------------------------------------------------------------------------
-- resposta_sessao  (cada tentativa do aluno para uma palavra, dentro da sessao)
-- RN11 - As respostas so ficam registradas apos a tentativa do aluno.
-- ---------------------------------------------------------------------------
CREATE TABLE resposta_sessao (
    id_resposta      SERIAL      PRIMARY KEY,
    id_sessao        INTEGER     NOT NULL REFERENCES sessao_jogo(id_sessao)
                                 ON DELETE CASCADE,
    id_palavra       INTEGER     NOT NULL REFERENCES palavra(id_palavra),
    resposta_informada VARCHAR(100) NOT NULL,
    correta          BOOLEAN     NOT NULL,
    numero_tentativa INTEGER     NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Indices recomendados (aceleram filtros e consultas mais comuns)
-- ---------------------------------------------------------------------------
CREATE INDEX idx_palavra_cruzada_autor      ON palavra_cruzada (id_autor);
CREATE INDEX idx_palavra_cruzada_disciplina ON palavra_cruzada (id_disciplina);
CREATE INDEX idx_versao_cruzada_cruzada     ON versao_cruzada  (id_cruzada);
CREATE INDEX idx_palavra_versao             ON palavra         (id_versao);
CREATE INDEX idx_sessao_aluno_versao        ON sessao_jogo     (id_aluno, id_versao, inicio);
CREATE INDEX idx_resposta_sessao_sessao     ON resposta_sessao (id_sessao, id_palavra);
