// ============================================================================
// Validacao da grade da palavra cruzada.
//
// RN06 - O sistema so deve validar que todas as palavras se encaixam
//        corretamente na grade (intersecoes de letras corretas) APOS a
//        tentativa de salvar.
//
// Regras aplicadas na validacao:
//   1. Cada palavra precisa de resposta (>= 2 letras), dica, linha/coluna >= 1
//      e direcao 'horizontal' ou 'vertical'.
//   2. As celulas ocupadas por letras diferentes na mesma posicao configuram
//      uma intersecao invalida (conflito).
//   3. Uma cruzada precisa ter no minimo 2 palavras.
//   4. (Recomendado) as palavras devem formar um unico bloco conectado; se
//      houver palavras "soltas", emitimos um aviso — nao bloqueia o salvamento.
//
// A entrada usa linha/coluna 1-indexados (como no formulario e no banco).
// ============================================================================

// Normaliza a resposta: maiusculas, sem acentos, apenas letras/numeros.
export function normalizarResposta(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');      // remove espacos, pontuacao etc.
}

// Retorna a lista de celulas {linha, coluna, letra} ocupadas por uma palavra.
function celulasDaPalavra(palavra) {
  const resposta = normalizarResposta(palavra.resposta);
  const celulas = [];
  for (let i = 0; i < resposta.length; i++) {
    const linha = palavra.direcao === 'horizontal' ? palavra.linha : palavra.linha + i;
    const coluna = palavra.direcao === 'horizontal' ? palavra.coluna + i : palavra.coluna;
    celulas.push({ linha, coluna, letra: resposta[i] });
  }
  return celulas;
}

/**
 * Valida um conjunto de palavras.
 * @param {Array<{resposta,dica,linha,coluna,direcao}>} palavras
 * @returns {{ valido:boolean, erros:string[], avisos:string[], dimensoes:{linhas,colunas} }}
 */
export function validarGrade(palavras) {
  const erros = [];
  const avisos = [];

  if (!Array.isArray(palavras) || palavras.length < 2) {
    erros.push('A cruzada precisa ter pelo menos 2 palavras.');
    return { valido: false, erros, avisos, dimensoes: { linhas: 0, colunas: 0 } };
  }

  // 1) Validacao campo a campo.
  palavras.forEach((p, idx) => {
    const n = idx + 1;
    const resposta = normalizarResposta(p.resposta);
    if (resposta.length < 2) {
      erros.push(`Palavra ${n}: a resposta deve ter pelo menos 2 letras.`);
    }
    if (!p.dica || !String(p.dica).trim()) {
      erros.push(`Palavra ${n}: a dica e obrigatoria.`);
    }
    if (!Number.isInteger(p.linha) || p.linha < 1) {
      erros.push(`Palavra ${n}: a linha deve ser um inteiro >= 1.`);
    }
    if (!Number.isInteger(p.coluna) || p.coluna < 1) {
      erros.push(`Palavra ${n}: a coluna deve ser um inteiro >= 1.`);
    }
    if (p.direcao !== 'horizontal' && p.direcao !== 'vertical') {
      erros.push(`Palavra ${n}: direcao invalida (use horizontal ou vertical).`);
    }
  });

  // Se ha erro estrutural, nem tenta montar a grade.
  if (erros.length > 0) {
    return { valido: false, erros, avisos, dimensoes: { linhas: 0, colunas: 0 } };
  }

  // 2) Monta a grade e checa intersecoes.
  const grade = new Map(); // chave "linha,coluna" -> { letra, palavras:Set }
  let maxLinha = 0;
  let maxColuna = 0;

  palavras.forEach((p, idx) => {
    for (const c of celulasDaPalavra(p)) {
      maxLinha = Math.max(maxLinha, c.linha);
      maxColuna = Math.max(maxColuna, c.coluna);
      const chave = `${c.linha},${c.coluna}`;
      const existente = grade.get(chave);
      if (!existente) {
        grade.set(chave, { letra: c.letra, palavras: new Set([idx]) });
      } else {
        existente.palavras.add(idx);
        if (existente.letra !== c.letra) {
          erros.push(
            `Conflito de intersecao na celula (linha ${c.linha}, coluna ${c.coluna}): ` +
            `"${existente.letra}" x "${c.letra}".`
          );
        }
      }
    }
  });

  // 3) (Aviso) verifica se todas as palavras estao conectadas em um so bloco.
  //    Duas palavras estao ligadas se compartilham pelo menos uma celula.
  const conectado = new Set([0]);
  let mudou = true;
  const listaCelulas = palavras.map(celulasDaPalavra);
  while (mudou) {
    mudou = false;
    for (let i = 0; i < palavras.length; i++) {
      if (!conectado.has(i)) continue;
      for (let j = 0; j < palavras.length; j++) {
        if (conectado.has(j) || i === j) continue;
        const compartilha = listaCelulas[i].some((a) =>
          listaCelulas[j].some((b) => a.linha === b.linha && a.coluna === b.coluna)
        );
        if (compartilha) {
          conectado.add(j);
          mudou = true;
        }
      }
    }
  }
  if (conectado.size !== palavras.length) {
    avisos.push(
      'Existem palavras que nao se cruzam com nenhuma outra (grade desconectada). ' +
      'A cruzada foi salva, mas o ideal e que todas as palavras se cruzem.'
    );
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    dimensoes: { linhas: maxLinha, colunas: maxColuna }
  };
}

// Monta uma matriz (para renderizar/pre-visualizar a grade).
// Celulas vazias sao null.
export function montarMatriz(palavras) {
  let maxLinha = 0;
  let maxColuna = 0;
  const celulas = [];
  for (const p of palavras) {
    for (const c of celulasDaPalavra(p)) {
      celulas.push(c);
      maxLinha = Math.max(maxLinha, c.linha);
      maxColuna = Math.max(maxColuna, c.coluna);
    }
  }
  const matriz = Array.from({ length: maxLinha }, () =>
    Array.from({ length: maxColuna }, () => null)
  );
  for (const c of celulas) {
    matriz[c.linha - 1][c.coluna - 1] = c.letra;
  }
  return matriz;
}
