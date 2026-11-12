-- ============================================================================
-- Migracao 002 - integracao com o Ludica no padrao da Sprint 6
--
-- A entrada passou a ser um POST com url_retorno: e para ela que o resultado
-- da partida e enviado. Guardamos a ultima recebida de cada usuario.
-- Pode rodar mais de uma vez sem problema.
--
--   docker compose exec -T postgres psql -U postgres -d palavras_cruzadas \
--     < backend/db/postgres/migracoes/002_ludica_sprint6.sql
-- ============================================================================
BEGIN;

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ludica_url_retorno VARCHAR(500);

-- Partidas pendentes do formato antigo (sem url_retorno) nao tem para onde ir.
UPDATE sessao_jogo s
   SET ludica_envio = 'falhou', ludica_erro = 'formato antigo (antes da Sprint 6)'
  FROM usuario u
 WHERE u.id_usuario = s.id_aluno
   AND s.ludica_envio = 'pendente'
   AND u.ludica_url_retorno IS NULL;

COMMIT;
