// ============================================================================
// Envio da pontuacao das partidas para o Ludica (a "volta" da integracao).
//
// Ao encerrar, a partida fica com ludica_envio = 'pendente' (na mesma
// transacao que grava a pontuacao). Depois do commit tentamos enviar na hora;
// se o Ludica estiver fora do ar, um laco periodico reenvia com espera
// crescente (1, 2, 4... ate 60 min) e desiste apos MAX_TENTATIVAS ('falhou').
//
// A reserva da sessao e um UPDATE atomico: a mesma partida nunca e enviada
// duas vezes ao mesmo tempo (o Ludica soma os pontos, entao duplicar contaria
// em dobro).
// ============================================================================
import { pool } from '../db/postgres.js';
import { configLudica, postarPontuacao } from './ludica.js';

export const MAX_TENTATIVAS = 10;

/** Tenta enviar uma partida pendente. Devolve true se enviou. */
export async function enviarPontuacaoDaSessao(idSessao) {
  if (!configLudica().urlPontuacao) return false;

  const { rows } = await pool.query(
    `UPDATE sessao_jogo s
        SET ludica_tentativas = s.ludica_tentativas + 1,
            ludica_proxima = CURRENT_TIMESTAMP
                           + make_interval(mins => LEAST(60, power(2, s.ludica_tentativas)::int))
       FROM usuario u
      WHERE s.id_sessao = $1
        AND u.id_usuario = s.id_aluno
        AND s.ludica_envio = 'pendente'
        AND (s.ludica_proxima IS NULL OR s.ludica_proxima <= CURRENT_TIMESTAMP)
  RETURNING s.pontuacao::float AS pontuacao, s.ludica_tentativas AS tentativas, u.email, u.usertag`,
    [idSessao]
  );
  const envio = rows[0];
  if (!envio) return false; // ja enviada, desistida ou outro processo cuidando

  try {
    await postarPontuacao({ email: envio.email, gamertag: envio.usertag, pontuacao: envio.pontuacao });
    await pool.query(
      `UPDATE sessao_jogo
          SET ludica_envio = 'enviado', ludica_enviado_em = CURRENT_TIMESTAMP, ludica_erro = NULL
        WHERE id_sessao = $1`,
      [idSessao]
    );
    return true;
  } catch (err) {
    const desistir = envio.tentativas >= MAX_TENTATIVAS;
    await pool.query(
      `UPDATE sessao_jogo SET ludica_envio = $2, ludica_erro = $3 WHERE id_sessao = $1`,
      [idSessao, desistir ? 'falhou' : 'pendente', String(err.message || err).slice(0, 500)]
    );
    console.warn(`[ludica] partida ${idSessao}: envio ${envio.tentativas}/${MAX_TENTATIVAS} falhou - ${err.message}`);
    return false;
  }
}

/** Dispara o envio sem segurar a resposta ao aluno. */
export function enviarEmSegundoPlano(idSessao) {
  enviarPontuacaoDaSessao(idSessao).catch((err) =>
    console.error(`[ludica] partida ${idSessao}: erro inesperado no envio`, err)
  );
}

/** Reenvia as partidas pendentes cuja espera ja passou. */
export async function reenviarPendentes(limite = 20) {
  if (!configLudica().urlPontuacao) return 0;
  const { rows } = await pool.query(
    `SELECT id_sessao FROM sessao_jogo
      WHERE ludica_envio = 'pendente'
        AND (ludica_proxima IS NULL OR ludica_proxima <= CURRENT_TIMESTAMP)
      ORDER BY fim
      LIMIT $1`,
    [limite]
  );
  let enviadas = 0;
  for (const { id_sessao } of rows) {
    if (await enviarPontuacaoDaSessao(id_sessao)) enviadas++;
  }
  return enviadas;
}

/** Liga o laco de reenvio (chamado pelo server.js). */
export function iniciarReenvioPeriodico(intervaloMs = Number(process.env.LUDICA_REENVIO_MS || 60_000)) {
  if (!configLudica().urlPontuacao) {
    console.warn('[ludica] LUDICA_URL_PONTUACAO não definida: pontuações ficam pendentes, sem envio.');
    return;
  }
  const rodar = () =>
    reenviarPendentes().catch((err) => console.error('[ludica] erro no reenvio periódico', err));
  rodar();
  setInterval(rodar, intervaloMs).unref();
}
