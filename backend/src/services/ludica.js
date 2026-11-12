// ============================================================================
// Integracao com o Ludica, seguindo o padrao do Ludica para todos os jogos
// (Ludica: Documents/Integracao/Guia_Integracao_Jogos.md).
//
// IDA   - o navegador do jogador chega por um POST de formulario com
//         tipo_usuario, email, gamertag, hash, jogo, data e url_retorno.
//         Conferimos o hash com o NOSSO nome de jogo e a NOSSA data de hoje.
// VOLTA - no fim da partida enviamos um POST JSON para o url_retorno com
//         jogo, gamertag, data, pontos, tempo_segundos e hash.
//
// Hash  = hex( SHA-256( "LUD1C@-NOMEJOGO-JOGAR|JOGOU-GAMERTAG-DDMMAAAA" ) )
//
// A unica configuracao e LUDICA_NOME_JOGO (padrao CRUZADINHA): tem que ser o
// titulo com que o jogo esta cadastrado no Ludica (maiusculo, sem acento e
// sem espaco).
// ============================================================================
import crypto from 'node:crypto';

export const PREFIXO = 'LUD1C@';
export const NOME_JOGO_PADRAO = 'CRUZADINHA';
export const FUSO = 'America/Sao_Paulo';

const env = (nome, padrao) => {
  const v = process.env[nome];
  return v === undefined || v === '' ? padrao : v;
};

/** "Palavras Cruzadas" -> "PALAVRASCRUZADAS" (mesma regra do Ludica). */
export function nomeDoJogo(titulo) {
  return String(titulo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export const configLudica = () => ({
  nomeJogo: nomeDoJogo(env('LUDICA_NOME_JOGO', NOME_JOGO_PADRAO)),
  timeoutMs: Number(env('LUDICA_TIMEOUT_MS', '10000'))
});

/** Data de hoje "DDMMAAAA" no horario de Brasilia. */
export function dataDoDia(quando = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(quando)
      .map((p) => [p.type, p.value])
  );
  return `${partes.day}${partes.month}${partes.year}`;
}

/** "LUD1C@-NOMEJOGO-ACAO-GAMERTAG-DDMMAAAA" */
export const montarSeed = (jogo, acao, gamertag, data) => `${PREFIXO}-${jogo}-${acao}-${gamertag}-${data}`;

export const sha256 = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

/** Hash de ida (acao JOGAR) ou de volta (JOGOU). */
export function hashLudica(acao, gamertag, data = dataDoDia(), jogo = configLudica().nomeJogo) {
  return sha256(montarSeed(jogo, acao, gamertag, data));
}

function iguais(a, b) {
  const x = Buffer.from(String(a).toLowerCase());
  const y = Buffer.from(String(b).toLowerCase());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Confere o hash da ida. So vale no dia em que foi gerado. */
export function hashEntradaValido(gamertag, hash, agora = new Date()) {
  if (!gamertag || !hash) return false;
  return iguais(hashLudica('JOGAR', gamertag, dataDoDia(agora)), hash);
}

// tipo_usuario do Ludica -> papel na Cruzadinha. "administrador" no Ludica
// e partida de teste: joga como aluno. O administrador da Cruzadinha e
// definido so no nosso banco.
const PAPEIS = { aluno: 'aluno', professor: 'professor', administrador: 'aluno' };

/** tipo_usuario -> papel local, ou null se desconhecido. */
export const papelDoTipo = (tipo) => PAPEIS[String(tipo ?? '').trim().toLowerCase()] ?? null;

/** url_retorno precisa ser http(s). */
export function urlRetornoValida(url) {
  try {
    return ['http:', 'https:'].includes(new URL(String(url)).protocol);
  } catch {
    return false;
  }
}

/** Campos que o Ludica mandaria na ida (usado so pelo simulador de desenvolvimento). */
export function camposDeEntrada({ tipo_usuario, email, gamertag, url_retorno }) {
  const data = dataDoDia();
  const { nomeJogo } = configLudica();
  return {
    tipo_usuario,
    email,
    gamertag,
    hash: hashLudica('JOGAR', gamertag, data, nomeJogo),
    jogo: nomeJogo,
    data,
    url_retorno
  };
}

/** Corpo da volta, na ordem do guia. */
export function corpoDaVolta({ gamertag, pontos, tempoSegundos }, agora = new Date()) {
  const { nomeJogo } = configLudica();
  const data = dataDoDia(agora);
  return {
    jogo: nomeJogo,
    gamertag,
    data,
    pontos: Math.max(0, Math.round(Number(pontos) || 0)),
    tempo_segundos: Math.max(0, Math.round(Number(tempoSegundos) || 0)),
    hash: hashLudica('JOGOU', gamertag, data, nomeJogo)
  };
}

/**
 * Envia o resultado de uma partida para o url_retorno do Ludica.
 * Lanca erro se a resposta nao for 2xx. `err.definitivo` = true para 4xx:
 * o Ludica recusou os dados, reenviar nao adianta.
 */
export async function postarResultado(urlRetorno, dados) {
  const corpo = corpoDaVolta(dados);
  const resp = await fetch(urlRetorno, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(configLudica().timeoutMs)
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    let motivo = texto.slice(0, 200);
    try {
      motivo = JSON.parse(texto).error ?? motivo;
    } catch { /* corpo nao e JSON */ }
    const err = new Error(`Lúdica respondeu ${resp.status}: ${motivo}`);
    // 408 (timeout) e 429 (muitas chamadas) sao passageiros: vale reenviar.
    err.definitivo = resp.status >= 400 && resp.status < 500 && ![408, 429].includes(resp.status);
    throw err;
  }
  return { corpo, resposta: await resp.json().catch(() => null) };
}
