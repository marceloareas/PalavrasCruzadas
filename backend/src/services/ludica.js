// ============================================================================
// Integracao com o Ludica.
//
// IDA  - o usuario, logado no Ludica, clica num link para a Cruzadinha:
//        /api/auth/ludica?perfil=<n>&email=<...>&gamertag=<...>&token=<hash>
//        O token e um hash de (gamertag + data do dia + palavra fixa). Fazemos
//        o mesmo calculo e comparamos; se for diferente, acesso negado.
//
// VOLTA - ao terminar uma partida, mandamos a pontuacao num POST para a API
//        do Ludica: { email, gamertag, pontuacao, token }.
//
// O Ludica ainda nao fixou os detalhes (algoritmo, formato da data, numeros
// dos perfis, URL da API). Por isso tudo aqui e configuravel por variavel de
// ambiente e a regra do hash fica numa funcao so (`tokenLudica`).
// ============================================================================
import crypto from 'node:crypto';

const env = (nome, padrao) => {
  const v = process.env[nome];
  return v === undefined || v === '' ? padrao : v;
};

export const configLudica = () => ({
  segredo: env('LUDICA_SEGREDO', ''),
  segredoEnvio: env('LUDICA_SEGREDO_ENVIO', env('LUDICA_SEGREDO', '')),
  algoritmo: env('LUDICA_HASH', 'sha256'),
  fuso: env('LUDICA_FUSO', 'America/Sao_Paulo'),
  perfis: {
    [env('LUDICA_PERFIL_PROFESSOR', '1')]: 'professor',
    [env('LUDICA_PERFIL_ALUNO', '2')]: 'aluno'
  },
  urlPontuacao: env('LUDICA_URL_PONTUACAO', ''),
  idJogo: env('LUDICA_ID_JOGO', ''),
  timeoutMs: Number(env('LUDICA_TIMEOUT_MS', '10000'))
});

/** Data "AAAA-MM-DD" no fuso combinado com o Ludica. */
export function dataDoDia(quando = new Date(), fuso = configLudica().fuso) {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(quando);
}

/**
 * Regra do token: hex( HASH(gamertag + data + palavra) ).
 * Se o Ludica definir outra ordem/separador/formato, ajustar SO aqui.
 */
export function tokenLudica(gamertag, data, segredo, algoritmo = configLudica().algoritmo) {
  return crypto.createHash(algoritmo).update(`${gamertag}${data}${segredo}`, 'utf8').digest('hex');
}

function iguais(a, b) {
  const x = Buffer.from(String(a).toLowerCase());
  const y = Buffer.from(String(b).toLowerCase());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Confere o token recebido. Aceita o dia de hoje e o de ontem, para o link
 * gerado as 23:59 ainda funcionar as 00:01.
 */
export function tokenValido(gamertag, token, agora = new Date()) {
  const { segredo } = configLudica();
  if (!segredo || !gamertag || !token) return false;
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  return [agora, ontem].some((d) => iguais(tokenLudica(gamertag, dataDoDia(d), segredo), token));
}

/** perfil (numero do Ludica) -> papel local, ou null se desconhecido. */
export function papelDoPerfil(perfil) {
  return configLudica().perfis[String(perfil ?? '').trim()] ?? null;
}

/** Monta o link de entrada (usado pelo login de desenvolvimento e pelo script). */
export function linkDeEntrada({ perfil, email, gamertag }, base = '') {
  const { segredo } = configLudica();
  const token = tokenLudica(gamertag, dataDoDia(), segredo);
  const qs = new URLSearchParams({ perfil: String(perfil), email, gamertag, token });
  return `${base}/api/auth/ludica?${qs}`;
}

/**
 * Envia a pontuacao de uma partida para o Ludica.
 * Lanca erro se a API nao responder 2xx (quem chama decide se reenvia).
 */
export async function postarPontuacao({ email, gamertag, pontuacao }) {
  const cfg = configLudica();
  if (!cfg.urlPontuacao) throw new Error('LUDICA_URL_PONTUACAO não configurada.');

  const corpo = {
    email,
    gamertag,
    pontuacao,
    token: tokenLudica(gamertag, dataDoDia(), cfg.segredoEnvio)
  };
  if (cfg.idJogo) corpo.id_jogo = Number(cfg.idJogo) || cfg.idJogo;

  const resp = await fetch(cfg.urlPontuacao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Lúdica respondeu ${resp.status}: ${texto.slice(0, 200)}`);
  }
}
