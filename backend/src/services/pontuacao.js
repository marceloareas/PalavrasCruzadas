// ============================================================================
// Calculo da pontuacao de uma partida (RN12). Parametros em regras.js.
//
// Fluxo do jogo: o aluno preenche a grade e confere; o sistema diz apenas
// QUANTAS palavras estao certas. Ele pode conferir de novo quantas vezes
// quiser ate completar ou encerrar.
// ============================================================================
import { PONTUACAO } from '../regras.js';

/**
 * Em qual tentativa a palavra foi acertada, considerando que ela precisa
 * ficar certa ate o fim (acertar na 1a e estragar na 2a nao vale como 1a).
 * @param {boolean[]} historico  correta? em cada tentativa, na ordem
 * @returns {number|null}  numero da tentativa (1..N) ou null se terminou errada
 */
export function tentativaDoAcerto(historico) {
  if (!historico.length || !historico[historico.length - 1]) return null;
  const ultimoErro = historico.lastIndexOf(false);
  return ultimoErro + 2; // -1 (nunca errou) -> 1
}

/**
 * @param {{ acertos: Array<number|null>, dificuldade: string, tempo: number }} partida
 *   acertos: tentativa do acerto de cada palavra (null = errada no fim)
 *   tempo:   segundos
 */
export function calcularPontuacao({ acertos, dificuldade, tempo }, cfg = PONTUACAO) {
  const total = acertos.length;
  const certas = acertos.filter((t) => t !== null).length;
  const completa = total > 0 && certas === total;
  const mult = cfg.multiplicadorDificuldade[dificuldade] ?? 1;
  const fator = (t) => cfg.fatorPorTentativa[Math.min(t, cfg.fatorPorTentativa.length) - 1];

  const porTentativa = {};
  let pontosPalavras = 0;
  for (const t of acertos) {
    if (t === null) continue;
    porTentativa[t] = (porTentativa[t] ?? 0) + 1;
    pontosPalavras += cfg.pontosPorPalavra * fator(t);
  }
  pontosPalavras *= mult;

  const tempoReferencia = total * cfg.segundosPorPalavra;
  const fracaoTempo = completa ? Math.max(0, 1 - tempo / tempoReferencia) : 0;
  const bonusTempo = pontosPalavras * cfg.bonusTempoMaximo * fracaoTempo;
  const bonusCompleta = completa ? pontosPalavras * cfg.bonusCompleta : 0;

  return {
    pontuacao: Math.round(pontosPalavras + bonusTempo + bonusCompleta),
    detalhe: {
      certas,
      total,
      completa,
      acertos_por_tentativa: porTentativa,
      multiplicador_dificuldade: mult,
      pontos_palavras: Math.round(pontosPalavras),
      bonus_tempo: Math.round(bonusTempo),
      bonus_completa: Math.round(bonusCompleta)
    }
  };
}
