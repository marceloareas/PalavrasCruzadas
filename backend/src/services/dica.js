// ============================================================================
// Dica "revelar letra" (RN20) - logica pura, sem banco.
//
// A casa revelada e a primeira casa VAZIA da palavra escolhida (no que o
// aluno tem na tela) que ainda nao foi revelada; se nao houver casa vazia,
// a primeira ainda nao revelada. A escolha nunca depende de a letra digitada
// estar certa - senao a dica contaria de graca se a palavra esta correta.
// ============================================================================

const chave = (l, c) => `${l},${c}`;

/** Casas da palavra, em ordem: [{ linha, coluna, letra }]. */
export function casasDaPalavra(p) {
  return [...p.resposta].map((letra, i) => ({
    linha: p.direcao === 'vertical' ? p.linha + i : p.linha,
    coluna: p.direcao === 'horizontal' ? p.coluna + i : p.coluna,
    letra
  }));
}

/**
 * @param {object} palavra   palavra do conteudo da versao (com resposta e posicao)
 * @param {string} atual     o que o aluno tem na tela para essa palavra (' ' = vazia)
 * @param {Set<string>} reveladas  casas ja reveladas ("linha,coluna")
 * @returns {{ linha, coluna, letra } | null}  null = todas as casas ja reveladas
 */
export function escolherCasa(palavra, atual, reveladas) {
  const casas = casasDaPalavra(palavra).filter((c) => !reveladas.has(chave(c.linha, c.coluna)));
  if (!casas.length) return null;
  const texto = String(atual ?? '');
  const todas = casasDaPalavra(palavra);
  const vazia = casas.find((c) => {
    const i = todas.findIndex((t) => t.linha === c.linha && t.coluna === c.coluna);
    return !texto[i] || !texto[i].trim();
  });
  return vazia ?? casas[0];
}

/** Quantas casas reveladas cada palavra tem (na ordem de `palavras`). */
export function reveladasPorPalavra(palavras, dicas) {
  const reveladas = new Set(dicas.map((d) => chave(d.linha, d.coluna)));
  return palavras.map((p) => casasDaPalavra(p).filter((c) => reveladas.has(chave(c.linha, c.coluna))).length);
}
