// ============================================================================
// Geracao automatica da grade da palavra cruzada.
//
// O professor cadastra apenas respostas + dicas; o sistema decide linha,
// coluna e direcao de cada palavra (RN14).
//
// RN06 - A validacao acontece ao salvar: se alguma palavra nao puder ser
//        encaixada cruzando com as demais, o salvamento e recusado e o
//        professor recebe a lista das palavras problematicas.
//
// Algoritmo (guloso com varias tentativas):
//   1. Coloca a primeira palavra na horizontal.
//   2. Para cada palavra seguinte, testa todas as posicoes em que ela cruza
//      uma letra igual ja colocada e escolhe a de melhor pontuacao
//      (mais cruzamentos, grade mais compacta).
//   3. Palavras que nao couberam sao re-tentadas ao final.
//   4. Repete com ordens diferentes (embaralhamento com semente fixa, logo
//      a mesma entrada sempre gera a mesma grade) e fica com o melhor
//      resultado: menos palavras de fora e, depois, menor area.
// ============================================================================
import { MIN_PALAVRAS, MAX_PALAVRAS, MIN_LETRAS, MAX_LETRAS, MAX_DICA } from '../regras.js';

// Normaliza a resposta: maiusculas, sem acentos, apenas letras/numeros.
export function normalizarResposta(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Valida os campos informados pelo professor (antes de gerar a grade).
 * @param {Array<{resposta, dica}>} palavras
 * @returns {string[]} lista de erros (vazia se ok)
 */
export function validarPalavras(palavras) {
  const erros = [];
  const lista = Array.isArray(palavras) ? palavras : [];

  if (lista.length < MIN_PALAVRAS || lista.length > MAX_PALAVRAS) {
    erros.push(
      `O jogo deve ter entre ${MIN_PALAVRAS} e ${MAX_PALAVRAS} palavras (informadas: ${lista.length}).`
    );
  }

  const vistas = new Map();
  lista.forEach((p, idx) => {
    const n = idx + 1;
    const resposta = normalizarResposta(p?.resposta);
    const dica = String(p?.dica ?? '').trim();
    if (resposta.length < MIN_LETRAS || resposta.length > MAX_LETRAS) {
      erros.push(`Palavra ${n}: a resposta deve ter entre ${MIN_LETRAS} e ${MAX_LETRAS} letras.`);
    }
    if (!dica) erros.push(`Palavra ${n}: a dica é obrigatória.`);
    if (dica.length > MAX_DICA) erros.push(`Palavra ${n}: a dica passa de ${MAX_DICA} caracteres.`);
    if (resposta && vistas.has(resposta)) {
      erros.push(`Palavra ${n}: "${resposta}" repete a palavra ${vistas.get(resposta)}.`);
    } else if (resposta) {
      vistas.set(resposta, n);
    }
  });

  return erros;
}

// ---------------------------------------------------------------------------
// Grade esparsa: Map "linha,coluna" -> { letra, horizontal, vertical }
// ---------------------------------------------------------------------------
const DELTA = {
  horizontal: { dl: 0, dc: 1 },
  vertical: { dl: 1, dc: 0 }
};
const chave = (l, c) => `${l},${c}`;

// Retorna quantos cruzamentos a palavra faria na posicao, ou -1 se invalida.
function avaliarPosicao(celulas, palavra, linha, coluna, direcao) {
  const { dl, dc } = DELTA[direcao];
  const antes = chave(linha - dl, coluna - dc);
  const depois = chave(linha + dl * palavra.length, coluna + dc * palavra.length);
  if (celulas.has(antes) || celulas.has(depois)) return -1;

  let cruzamentos = 0;
  for (let i = 0; i < palavra.length; i++) {
    const l = linha + dl * i;
    const c = coluna + dc * i;
    const cel = celulas.get(chave(l, c));
    if (cel) {
      // Celula ocupada: so vale se for um cruzamento com a mesma letra.
      if (cel.letra !== palavra[i] || cel[direcao]) return -1;
      cruzamentos++;
    } else {
      // Celula livre: os vizinhos laterais precisam estar vazios para nao
      // formar "palavras" acidentais encostadas.
      if (celulas.has(chave(l + dc, c + dl)) || celulas.has(chave(l - dc, c - dl))) return -1;
    }
  }
  return cruzamentos;
}

function colocar(celulas, palavra, linha, coluna, direcao) {
  const { dl, dc } = DELTA[direcao];
  for (let i = 0; i < palavra.length; i++) {
    const k = chave(linha + dl * i, coluna + dc * i);
    const cel = celulas.get(k) || { letra: palavra[i], horizontal: false, vertical: false };
    cel[direcao] = true;
    celulas.set(k, cel);
  }
}

function limites(colocadas) {
  let minL = Infinity, maxL = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const p of colocadas) {
    const { dl, dc } = DELTA[p.direcao];
    minL = Math.min(minL, p.linha);
    minC = Math.min(minC, p.coluna);
    maxL = Math.max(maxL, p.linha + dl * (p.resposta.length - 1));
    maxC = Math.max(maxC, p.coluna + dc * (p.resposta.length - 1));
  }
  return { minL, maxL, minC, maxC, linhas: maxL - minL + 1, colunas: maxC - minC + 1 };
}

// Procura a melhor posicao (que cruze ao menos uma letra) para a palavra.
function melhorPosicao(celulas, colocadas, palavra) {
  let melhor = null;
  for (const [k, cel] of celulas) {
    const [l, c] = k.split(',').map(Number);
    // Cruza na direcao que ainda esta livre nessa celula.
    const direcao = cel.horizontal ? 'vertical' : 'horizontal';
    if (cel[direcao]) continue;
    for (let i = 0; i < palavra.length; i++) {
      if (palavra[i] !== cel.letra) continue;
      const linha = direcao === 'vertical' ? l - i : l;
      const coluna = direcao === 'horizontal' ? c - i : c;
      const cruzamentos = avaliarPosicao(celulas, palavra, linha, coluna, direcao);
      if (cruzamentos < 1) continue;

      const b = limites([...colocadas, { resposta: palavra, linha, coluna, direcao }]);
      const pontuacao = cruzamentos * 1000 - b.linhas * b.colunas - Math.abs(b.linhas - b.colunas) * 5;
      if (!melhor || pontuacao > melhor.pontuacao) {
        melhor = { linha, coluna, direcao, pontuacao };
      }
    }
  }
  return melhor;
}

function montarTentativa(ordem) {
  const celulas = new Map();
  const colocadas = [];
  let pendentes = [];

  const [primeira, ...resto] = ordem;
  colocar(celulas, primeira.resposta, 0, 0, 'horizontal');
  colocadas.push({ ...primeira, linha: 0, coluna: 0, direcao: 'horizontal' });

  pendentes = resto;
  // Re-tenta as que sobraram enquanto houver progresso.
  let progresso = true;
  while (pendentes.length > 0 && progresso) {
    progresso = false;
    const sobra = [];
    for (const p of pendentes) {
      const pos = melhorPosicao(celulas, colocadas, p.resposta);
      if (pos) {
        colocar(celulas, p.resposta, pos.linha, pos.coluna, pos.direcao);
        colocadas.push({ ...p, linha: pos.linha, coluna: pos.coluna, direcao: pos.direcao });
        progresso = true;
      } else {
        sobra.push(p);
      }
    }
    pendentes = sobra;
  }
  return { colocadas, pendentes };
}

// PRNG simples com semente (mulberry32) para embaralhar de forma reprodutivel.
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, rand) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Numera as palavras como numa cruzada de jornal: da esquerda p/ direita,
// de cima p/ baixo; palavras que comecam na mesma celula dividem o numero.
function numerar(palavras) {
  const inicios = [...new Set(palavras.map((p) => chave(p.linha, p.coluna)))]
    .map((k) => k.split(',').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numeroDe = new Map(inicios.map(([l, c], i) => [chave(l, c), i + 1]));
  return palavras.map((p) => ({ ...p, numero: numeroDe.get(chave(p.linha, p.coluna)) }));
}

/**
 * Gera a grade a partir das respostas.
 * @param {Array<{resposta, dica}>} palavras  (ja validadas)
 * @param {{ tentativas?: number }} opcoes
 * @returns {{ ok: boolean, linhas: number, colunas: number,
 *             palavras: Array<{indice, resposta, dica, linha, coluna, direcao, numero}>,
 *             naoEncaixadas: string[] }}
 *   linha/coluna sao 1-indexados; `indice` e a posicao (1..N) na lista original.
 */
export function gerarGrade(palavras, { tentativas = 60 } = {}) {
  const base = palavras.map((p, i) => ({
    indice: i + 1,
    resposta: normalizarResposta(p.resposta),
    dica: String(p.dica ?? '').trim()
  }));
  if (base.length === 0) return { ok: false, linhas: 0, colunas: 0, palavras: [], naoEncaixadas: [] };

  // Semente derivada das respostas: mesma entrada -> mesma grade.
  const semente = [...base.map((p) => p.resposta).join('|')]
    .reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  const rand = aleatorio(semente);

  const porTamanho = [...base].sort((a, b) => b.resposta.length - a.resposta.length);
  let melhor = null;
  for (let t = 0; t < tentativas; t++) {
    // 1a tentativa: maiores primeiro. Demais: maior fixa + resto embaralhado.
    const ordem = t === 0 ? porTamanho : [porTamanho[0], ...embaralhar(porTamanho.slice(1), rand)];
    const r = montarTentativa(t % 7 === 6 ? embaralhar(base, rand) : ordem);
    const b = limites(r.colocadas);
    const area = b.linhas * b.colunas;
    if (
      !melhor ||
      r.pendentes.length < melhor.r.pendentes.length ||
      (r.pendentes.length === melhor.r.pendentes.length && area < melhor.area)
    ) {
      melhor = { r, b, area };
    }
  }

  const { r, b } = melhor;
  const posicionadas = numerar(
    r.colocadas.map((p) => ({ ...p, linha: p.linha - b.minL + 1, coluna: p.coluna - b.minC + 1 }))
  ).sort((x, y) => x.indice - y.indice);

  return {
    ok: r.pendentes.length === 0,
    linhas: b.linhas,
    colunas: b.colunas,
    palavras: posicionadas,
    naoEncaixadas: r.pendentes.map((p) => p.resposta)
  };
}

/**
 * Monta a matriz linhas x colunas (celulas vazias = null).
 * Com `ocultarLetras`, as celulas usadas viram '' (para o aluno - RN11).
 */
export function montarMatriz({ linhas, colunas, palavras }, { ocultarLetras = false } = {}) {
  const matriz = Array.from({ length: linhas }, () => Array.from({ length: colunas }, () => null));
  for (const p of palavras) {
    const { dl, dc } = DELTA[p.direcao];
    for (let i = 0; i < p.resposta.length; i++) {
      matriz[p.linha - 1 + dl * i][p.coluna - 1 + dc * i] = ocultarLetras ? '' : p.resposta[i];
    }
  }
  return matriz;
}
