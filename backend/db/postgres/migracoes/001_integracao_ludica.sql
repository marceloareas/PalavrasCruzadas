-- ============================================================================
-- Migracao 001 - integracao com o Ludica
--
-- Para bancos criados ANTES desta versao (o schema.sql so roda na 1a subida).
-- Pode rodar mais de uma vez sem problema.
--
--   docker compose exec -T postgres psql -U postgres -d palavras_cruzadas \
--     < backend/db/postgres/migracoes/001_integracao_ludica.sql
-- ============================================================================
BEGIN;

-- O link do Ludica nao traz id: a chave passa a ser a gamertag (usertag).
ALTER TABLE usuario ALTER COLUMN id_ludica DROP NOT NULL;

-- Envio da pontuacao de cada partida ao Ludica.
ALTER TABLE sessao_jogo
    ADD COLUMN IF NOT EXISTS ludica_envio      VARCHAR(10)
        CHECK (ludica_envio IN ('pendente', 'enviado', 'falhou')),
    ADD COLUMN IF NOT EXISTS ludica_tentativas INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ludica_proxima    TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ludica_enviado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ludica_erro       TEXT;

-- Partidas antigas ficam com ludica_envio NULL: nao sao enviadas.

CREATE INDEX IF NOT EXISTS idx_sessao_ludica_pendente
    ON sessao_jogo (fim) WHERE ludica_envio = 'pendente';

COMMIT;
