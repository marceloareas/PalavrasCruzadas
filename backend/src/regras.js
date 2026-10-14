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
