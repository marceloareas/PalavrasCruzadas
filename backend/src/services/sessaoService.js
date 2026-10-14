// ============================================================================
// Partida do aluno (RN10/RN11/RN12).
//
// 1. O aluno inicia uma sessao na versao atual de uma cruzada publicada.
// 2. Preenche a grade e "confere": o sistema responde so QUANTAS palavras
//    estao certas (nao diz quais). Cada conferencia e uma tentativa e cada
//    palavra enviada vira uma linha em resposta_sessao.
// 3. A partida termina quando todas estao certas ou quando o aluno encerra.
//    So entao o gabarito e mostrado (RN11) e a pontuacao e calculada.
//
// O tempo e medido pelo servidor (inicio/fim), nao pelo navegador.
// ============================================================================
import { pool, withTransaction } from '../db/postgres.js';
import { obterCabecalho, obterConteudo } from './cruzadaService.js';
import { montarTabuleiro } from './jogoService.js';
import { normalizarResposta, montarMatriz } from './gerador.js';
import { tentativaDoAcerto, calcularPontuacao } from './pontuacao.js';
import { escolherCasa, reveladasPorPalavra } from './dica.js';
import { DICAS } from '../regras.js';
import { naoEncontrado, proibido, conflito, validacao } from './erros.js';

/**
 * Inicia uma partida (RN10: pode jogar quantas vezes quiser). Se o aluno ja
 * tem uma partida em andamento na versao atual, devolve essa.
 */
export async function iniciarSessao(idCruzada, idAluno) {
  const cab = await obterCabecalho(idCruzada);
  if (!cab || cab.status !== 'publicado' || !cab.versao_atual) {
    throw naoEncontrado('Jogo não encontrado ou não publicado.');
  }
  const idVersao = cab.versao_atual.id_versao;
  const { rows: abertas } = await pool.query(
    `SELECT id_sessao FROM sessao_jogo
      WHERE id_versao = $1 AND id_aluno = $2 AND fim IS NULL
      ORDER BY inicio DESC LIMIT 1`,
    [idVersao, idAluno]
  );
  if (abertas[0]) return { id_sessao: abertas[0].id_sessao, retomada: true };

  const { rows } = await pool.query(
    'INSERT INTO sessao_jogo (id_versao, id_aluno) VALUES ($1, $2) RETURNING id_sessao',
    [idVersao, idAluno]
  );
  return { id_sessao: rows[0].id_sessao, retomada: false };
}

// Carrega a sessao (do aluno) com o cabecalho da cruzada.
async function carregarSessao(executor, idSessao, idAluno, { bloquear = false } = {}) {
  const { rows } = await executor.query(
    `SELECT s.*, s.pontuacao::float AS pontuacao, v.id_cruzada, v.numero_versao, v.qtd_palavras,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.inicio))::int AS decorrido
       FROM sessao_jogo s
       JOIN versao_cruzada v ON v.id_versao = s.id_versao
      WHERE s.id_sessao = $1
      ${bloquear ? 'FOR UPDATE OF s' : ''}`,
    [idSessao]
  );
  const sessao = rows[0];
  if (!sessao) throw naoEncontrado('Partida não encontrada.');
  if (sessao.id_aluno !== idAluno) throw proibido('Esta partida é de outro aluno.');
  return sessao;
}

// Respostas ja enviadas, agrupadas por tentativa.
async function historico(executor, idSessao) {
  const { rows } = await executor.query(
    `SELECT numero_tentativa, indice_palavra, resposta_informada, correta
       FROM resposta_sessao WHERE id_sessao = $1
      ORDER BY numero_tentativa, indice_palavra`,
    [idSessao]
  );
  return rows;
}

// Letras reveladas por dica (RN20), na ordem em que foram pedidas.
async function dicasDaSessao(executor, idSessao) {
  const { rows } = await executor.query(
    `SELECT indice_palavra, linha, coluna, letra
       FROM dica_sessao WHERE id_sessao = $1 ORDER BY id_dica`,
    [idSessao]
  );
  return rows;
}

// Calcula o resultado a partir do historico (mesma regra na hora de
// finalizar e ao reabrir uma partida ja encerrada).
function resultado(sessao, conteudo, linhas, dificuldade, dicas) {
  const porPalavra = new Map(conteudo.palavras.map((p) => [p.indice, []]));
  for (const l of linhas) porPalavra.get(l.indice_palavra)?.push(l.correta);
  const acertos = conteudo.palavras.map((p) => tentativaDoAcerto(porPalavra.get(p.indice)));
  const reveladas = reveladasPorPalavra(conteudo.palavras, dicas);
  const r = calcularPontuacao({ acertos, dificuldade, tempo: sessao.tempo, reveladas });
  r.detalhe.dicas_usadas = dicas.length;
  return r;
}

function resumoTentativas(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    const t = mapa.get(l.numero_tentativa) ?? { tentativa: l.numero_tentativa, certas: 0 };
    if (l.correta) t.certas++;
    mapa.set(l.numero_tentativa, t);
  }
  return [...mapa.values()];
}

/** Estado da partida. Gabarito e pontuacao so depois de encerrada (RN11). */
export async function obterSessao(idSessao, idAluno) {
  const sessao = await carregarSessao(pool, idSessao, idAluno);
  const [cab, conteudo, linhas, dicas] = await Promise.all([
    obterCabecalho(sessao.id_cruzada),
    obterConteudo(sessao.id_versao),
    historico(pool, idSessao),
    dicasDaSessao(pool, idSessao)
  ]);

  // Ultimas respostas enviadas, para retomar a grade preenchida.
  const ultima = linhas.filter((l) => l.numero_tentativa === sessao.tentativas);
  const encerrada = Boolean(sessao.fim);

  const base = {
    id_sessao: sessao.id_sessao,
    id_cruzada: sessao.id_cruzada,
    titulo: cab.titulo,
    disciplina: cab.disciplina,
    dificuldade: cab.dificuldade,
    versao: sessao.numero_versao,
    total_palavras: sessao.qtd_palavras,
    inicio: sessao.inicio,
    decorrido: encerrada ? sessao.tempo : sessao.decorrido,
    encerrada,
    tentativas: resumoTentativas(linhas),
    ultimas_respostas: Object.fromEntries(ultima.map((l) => [l.indice_palavra, l.resposta_informada])),
    // RN20: letras ja reveladas (o aluno pediu) e quantas dicas ainda pode usar.
    dicas: dicas.map(({ linha, coluna, letra }) => ({ linha, coluna, letra })),
    dicas_restantes: Math.max(0, DICAS.maxPorPartida - dicas.length),
    desconto_por_letra: DICAS.descontoPorLetra,
    ...montarTabuleiro(conteudo)
  };
  if (!encerrada) return base;

  const certasNoFim = new Set(ultima.filter((l) => l.correta).map((l) => l.indice_palavra));
  return {
    ...base,
    pontuacao: sessao.pontuacao,
    tempo: sessao.tempo,
    resultado: resultado(sessao, conteudo, linhas, cab.dificuldade, dicas).detalhe,
    gabarito: {
      matriz: montarMatriz({ linhas: conteudo.grade.linhas, colunas: conteudo.grade.colunas, palavras: conteudo.palavras }),
      palavras: conteudo.palavras.map((p) => ({
        indice: p.indice,
        numero: p.numero,
        direcao: p.direcao,
        resposta: p.resposta,
        informada: ultima.find((l) => l.indice_palavra === p.indice)?.resposta_informada ?? '',
        correta: certasNoFim.has(p.indice)
      }))
    }
  };
}

// Fecha a sessao: grava fim, tempo, acertos e pontuacao.
async function finalizar(client, sessao, conteudo, dificuldade) {
  const { rows: [{ tempo }] } = await client.query(
    `SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - inicio))::int AS tempo
       FROM sessao_jogo WHERE id_sessao = $1`,
    [sessao.id_sessao]
  );
  const linhas = await historico(client, sessao.id_sessao);
  const dicas = await dicasDaSessao(client, sessao.id_sessao);
  const r = resultado({ ...sessao, tempo }, conteudo, linhas, dificuldade, dicas);
  await client.query(
    `UPDATE sessao_jogo
        SET fim = CURRENT_TIMESTAMP, tempo = $1, acertos = $2, pontuacao = $3
      WHERE id_sessao = $4`,
    [tempo, r.detalhe.certas, r.pontuacao, sessao.id_sessao]
  );
  return r;
}

/**
 * Confere a grade preenchida. `respostas` = { [indice]: "TEXTO" }.
 * Responde so quantas estao certas; se todas estiverem, encerra a partida.
 */
export async function conferir(idSessao, idAluno, respostas) {
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) {
    throw validacao(['Envie as respostas no formato { indice: "PALAVRA" }.']);
  }
  return withTransaction(async (client) => {
    const sessao = await carregarSessao(client, idSessao, idAluno, { bloquear: true });
    if (sessao.fim) throw conflito('Esta partida já foi encerrada.');
    const [conteudo, cab] = await Promise.all([
      obterConteudo(sessao.id_versao),
      obterCabecalho(sessao.id_cruzada)
    ]);

    const tentativa = sessao.tentativas + 1;
    let certas = 0;
    for (const p of conteudo.palavras) {
      const informada = normalizarResposta(respostas[p.indice]).slice(0, 100);
      const correta = informada === p.resposta;
      if (correta) certas++;
      await client.query(
        `INSERT INTO resposta_sessao (id_sessao, indice_palavra, resposta_informada, correta, numero_tentativa)
         VALUES ($1, $2, $3, $4, $5)`,
        [idSessao, p.indice, informada, correta, tentativa]
      );
    }
    const total = conteudo.palavras.length;
    // erros = soma das palavras erradas em todas as conferencias (RN12).
    await client.query(
      `UPDATE sessao_jogo SET tentativas = $1, acertos = $2, erros = erros + $3 WHERE id_sessao = $4`,
      [tentativa, certas, total - certas, idSessao]
    );

    const concluida = certas === total;
    if (concluida) await finalizar(client, { ...sessao, tentativas: tentativa }, conteudo, cab.dificuldade);
    return { tentativa, certas, total, concluida };
  });
}

/**
 * RN20 - Revela uma letra da palavra `indice`. `atual` e o que o aluno tem na
 * tela para essa palavra (' ' = casa vazia): a dica preenche a primeira casa
 * vazia, sem nunca indicar se o que ja foi digitado esta certo.
 */
export async function revelarLetra(idSessao, idAluno, { indice, atual } = {}) {
  return withTransaction(async (client) => {
    const sessao = await carregarSessao(client, idSessao, idAluno, { bloquear: true });
    if (sessao.fim) throw conflito('Esta partida já foi encerrada.');

    const dicas = await dicasDaSessao(client, idSessao);
    if (dicas.length >= DICAS.maxPorPartida) {
      throw conflito(`Você já usou as ${DICAS.maxPorPartida} dicas desta partida.`);
    }
    const conteudo = await obterConteudo(sessao.id_versao);
    const palavra = conteudo.palavras.find((p) => p.indice === Number(indice));
    if (!palavra) throw validacao(['Escolha uma palavra da grade para revelar uma letra.']);

    const reveladas = new Set(dicas.map((d) => `${d.linha},${d.coluna}`));
    const casa = escolherCasa(palavra, atual, reveladas);
    if (!casa) throw conflito('Todas as letras desta palavra já foram reveladas.');

    await client.query(
      `INSERT INTO dica_sessao (id_sessao, indice_palavra, linha, coluna, letra)
       VALUES ($1, $2, $3, $4, $5)`,
      [idSessao, palavra.indice, casa.linha, casa.coluna, casa.letra]
    );
    return { ...casa, dicas_restantes: DICAS.maxPorPartida - dicas.length - 1 };
  });
}

/** Aluno desiste/encerra: pontua com o que estava certo na ultima conferencia. */
export async function encerrar(idSessao, idAluno) {
  return withTransaction(async (client) => {
    const sessao = await carregarSessao(client, idSessao, idAluno, { bloquear: true });
    if (sessao.fim) throw conflito('Esta partida já foi encerrada.');
    const [conteudo, cab] = await Promise.all([
      obterConteudo(sessao.id_versao),
      obterCabecalho(sessao.id_cruzada)
    ]);
    await finalizar(client, sessao, conteudo, cab.dificuldade);
    return { encerrada: true };
  });
}
