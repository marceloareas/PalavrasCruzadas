// ============================================================================
// Limites de negocio compartilhados entre a API e o front (via GET /api/regras).
// ============================================================================

// RN13 - Um jogo tem no minimo 5 e no maximo 15 palavras.
export const MIN_PALAVRAS = 5;
export const MAX_PALAVRAS = 15;

// Tamanho permitido de cada resposta (apos normalizar).
export const MIN_LETRAS = 2;
export const MAX_LETRAS = 20;

export const MAX_DICA = 300;

export const PAPEIS = ['professor', 'aluno', 'administrador'];
export const DIFICULDADES = ['facil', 'medio', 'dificil'];
export const STATUS_CRUZADA = ['rascunho', 'publicado', 'arquivado'];

// ---------------------------------------------------------------------------
// Pontuacao da partida (RN12). Valores iniciais para o grupo ajustar.
// A logica esta em services/pontuacao.js.
// ---------------------------------------------------------------------------
export const PONTUACAO = {
  // Pontos de cada palavra certa no fim da partida.
  pontosPorPalavra: 100,
  // Fracao dos pontos conforme a tentativa em que a palavra foi acertada
  // (e ficou certa ate o fim): 1a = 100%, 2a = 70%, 3a = 50%, 4a ou mais = 30%.
  fatorPorTentativa: [1, 0.7, 0.5, 0.3],
  // Multiplicador pelo nivel de dificuldade (RN07).
  multiplicadorDificuldade: { facil: 1, medio: 1.2, dificil: 1.5 },
  // Bonus de tempo (so para quem completa a grade): ate +20% dos pontos,
  // caindo ate zero quando o tempo chega a 60 s por palavra.
  bonusTempoMaximo: 0.2,
  segundosPorPalavra: 60,
  // Bonus por completar a grade inteira.
  bonusCompleta: 0.1
};
