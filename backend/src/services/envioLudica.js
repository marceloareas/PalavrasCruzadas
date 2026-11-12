// ============================================================================
// Envio do resultado das partidas para o Ludica (a "volta" da integracao).
//
// Ao encerrar, a partida fica com ludica_envio = 'pendente' (na mesma
// transacao que grava a pontuacao) se o aluno entrou pelo Ludica, isto e, se
// temos o url_retorno dele. Depois do commit tentamos enviar na hora; se o
// Ludica estiver fora do ar, um laco periodico reenvia com espera crescente
// (1, 2, 4... ate 60 min) e desiste apos MAX_TENTATIVAS ('falhou').
// Se o Ludica RECUSAR os dados (4xx), nao adianta reenviar: vira 'falhou'
// na hora, com o motivo em ludica_erro.
//
// A reserva da sessao e um UPDATE atomico: a mesma partida nunca e enviada
// duas vezes ao mesmo tempo (o Ludica soma os pontos, entao duplicar contaria
// em dobro).
// ============================================================================
import { pool } from '../db/postgres.js';
import { postarResultado } from './ludica.js';

export const MAX_TENTATIVAS = 10;

/** Tenta enviar uma partida pendente. Devolve true se enviou. */
export async function enviarPontuacaoDaSessao(idSessao) {
  const { rows } = await pool.query(
    `UPDATE sessao_jogo s
        SET ludica_tentativas = s.ludica_tentativas + 1,
            ludica_proxima = CURRENT_TIMESTAMP
                           + make_interval(mins => LEAST(60, power(2, s.ludica_tentativas)::int))
       FROM usuario u, versao_cruzada v, palavra_cruzada pc
      WHERE s.id_sessao = $1
        AND u.id_usuario = s.id_aluno
        AND v.id_versao = s.id_versao
        AND pc.id_cruzada = v.id_cruzada
        AND s.ludica_envio = 'pendente'
        AND (s.ludica_proxima IS NULL OR s.ludica_proxima <= CURRENT_TIMESTAMP)
  RETURNING s.pontuacao::float AS pontuacao, s.tempo, s.ludica_tentativas AS tentativas,
            u.usertag, u.ludica_url_retorno, pc.titulo`,
    [idSessao]
  );
  const envio = rows[0];
  if (!envio) return false; // ja enviada, desistida ou outro processo cuidando

  const marcarFalha = async (motivo, definitivo) => {
    const desistir = definitivo || envio.tentativas >= MAX_TENTATIVAS;
    await pool.query(
      `UPDATE sessao_jogo SET ludica_envio = $2, ludica_erro = $3 WHERE id_sessao = $1`,
      [idSessao, desistir ? 'falhou' : 'pendente', String(motivo).slice(0, 500)]
    );
    console.warn(
      `[ludica] partida ${idSessao} de ${envio.usertag}: envio ${envio.tentativas}/${MAX_TENTATIVAS} falhou - ${motivo}` +
      (desistir ? ' (não será reenviada)' : ' (vai tentar de novo)')
    );
    return false;
  };

  if (!envio.ludica_url_retorno) return marcarFalha('sem url_retorno do Lúdica', true);

  try {
    const { corpo } = await postarResultado(envio.ludica_url_retorno, {
      gamertag: envio.usertag,
      pontos: envio.pontuacao,
      tempoSegundos: envio.tempo
    });
    await pool.query(
      `UPDATE sessao_jogo
          SET ludica_envio = 'enviado', ludica_enviado_em = CURRENT_TIMESTAMP, ludica_erro = NULL
        WHERE id_sessao = $1`,
      [idSessao]
    );
    console.log(
      `[ludica] partida ${idSessao} enviada ao Lúdica: ${corpo.gamertag}, ${corpo.pontos} pts, ` +
      `${corpo.tempo_segundos}s em "${envio.titulo}" (tentativa ${envio.tentativas})`
    );
    return true;
  } catch (err) {
    return marcarFalha(err.message || err, Boolean(err.definitivo));
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
  const rodar = () =>
    reenviarPendentes().catch((err) => console.error('[ludica] erro no reenvio periódico', err));
  rodar();
  setInterval(rodar, intervaloMs).unref();
}
