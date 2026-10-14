// ============================================================================
// Calculo da pontuacao de uma partida (RN12). Parametros em regras.js.
//
// Fluxo do jogo: o aluno preenche a grade e confere; o sistema diz apenas
// QUANTAS palavras estao certas. Ele pode conferir de novo quantas vezes
// quiser ate completar ou encerrar.
// ============================================================================
import { PONTUACAO, DICAS } from '../regras.js';

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
 *   reveladas: letras reveladas por dica (RN20) em cada palavra, na ordem de acertos
 */
export function calcularPontuacao(
  { acertos, dificuldade, tempo, reveladas = [] },
  cfg = PONTUACAO,
  descontoPorLetra = DICAS.descontoPorLetra
) {
  const total = acertos.length;
  const certas = acertos.filter((t) => t !== null).length;
  const completa = total > 0 && certas === total;
  const mult = cfg.multiplicadorDificuldade[dificuldade] ?? 1;
  const fator = (t) => cfg.fatorPorTentativa[Math.min(t, cfg.fatorPorTentativa.length) - 1];

  const porTentativa = {};
  let pontosPalavras = 0;
  let semDicas = 0;
  acertos.forEach((t, i) => {
    if (t === null) return;
    porTentativa[t] = (porTentativa[t] ?? 0) + 1;
    const pontos = cfg.pontosPorPalavra * fator(t);
    semDicas += pontos;
    // RN20: cada letra revelada na palavra tira uma fracao dos pontos dela.
    pontosPalavras += pontos * Math.max(0, 1 - descontoPorLetra * (reveladas[i] ?? 0));
  });
  pontosPalavras *= mult;
  semDicas *= mult;

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
      desconto_dicas: Math.round(semDicas - pontosPalavras),
      bonus_tempo: Math.round(bonusTempo),
      bonus_completa: Math.round(bonusCompleta)
    }
  };
}
