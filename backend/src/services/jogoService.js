// ============================================================================
// Lado do aluno: pesquisar jogos publicados e abrir um jogo.
// RN11 - O aluno nunca recebe as respostas: so a grade vazia, numeros e dicas.
// ============================================================================
import { pool } from '../db/postgres.js';
import { DIFICULDADES } from '../regras.js';
import { obterCabecalho, obterConteudo } from './cruzadaService.js';
import { montarMatriz } from './gerador.js';
import { naoEncontrado } from './erros.js';

/**
 * Pesquisa jogos publicados.
 * @param {{ texto?, idDisciplina?, dificuldade?, codigo?, idAluno }} filtros
 *   texto  -> procura no titulo, descricao, disciplina e autor
 *   codigo -> codigo de acesso exato (sem diferenciar maiusculas)
 */
export async function buscarJogos({ texto, idDisciplina, dificuldade, codigo, idAluno }) {
  const filtros = ["pc.status = 'publicado'"];
  const params = [idAluno];

  if (codigo && String(codigo).trim()) {
    params.push(String(codigo).trim().toUpperCase());
    filtros.push(`UPPER(pc.codigo_acesso) = $${params.length}`);
  }
  if (texto && String(texto).trim()) {
    params.push(`%${String(texto).trim()}%`);
    const p = `$${params.length}`;
    filtros.push(
      `(pc.titulo ILIKE ${p} OR pc.descricao ILIKE ${p} OR d.nome ILIKE ${p} OR u.nome ILIKE ${p})`
    );
  }
  const idDisc = Number.parseInt(idDisciplina, 10);
  if (Number.isInteger(idDisc)) {
    params.push(idDisc);
    filtros.push(`pc.id_disciplina = $${params.length}`);
  }
  if (DIFICULDADES.includes(dificuldade)) {
    params.push(dificuldade);
    filtros.push(`pc.dificuldade = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT pc.id_cruzada, pc.titulo, pc.descricao, pc.dificuldade, pc.codigo_acesso,
            pc.data_atualizacao, d.nome AS disciplina, d.codigo AS disciplina_codigo,
            u.nome AS autor_nome, u.usertag AS autor_usertag,
            v.qtd_palavras,
            (SELECT COUNT(*)::int FROM sessao_jogo s
               JOIN versao_cruzada vv ON vv.id_versao = s.id_versao
              WHERE vv.id_cruzada = pc.id_cruzada AND s.fim IS NOT NULL) AS partidas,
            (SELECT COUNT(*)::int FROM sessao_jogo s
               JOIN versao_cruzada vv ON vv.id_versao = s.id_versao
              WHERE vv.id_cruzada = pc.id_cruzada AND s.id_aluno = $1
                AND s.fim IS NOT NULL) AS minhas_partidas
       FROM palavra_cruzada pc
       JOIN disciplina d ON d.id_disciplina = pc.id_disciplina
       JOIN usuario u    ON u.id_usuario   = pc.id_autor
       JOIN LATERAL (
            SELECT qtd_palavras FROM versao_cruzada
             WHERE id_cruzada = pc.id_cruzada
             ORDER BY numero_versao DESC LIMIT 1) v ON TRUE
      WHERE ${filtros.join(' AND ')}
      ORDER BY pc.data_atualizacao DESC
      LIMIT 50`,
    params
  );
  return rows;
}

/**
 * Tabuleiro sem respostas (RN11): grade vazia, numeros e dicas com
 * posicao e tamanho de cada palavra.
 */
export function montarTabuleiro(conteudo) {
  const dicas = conteudo.palavras
    .map((p) => ({
      indice: p.indice,
      numero: p.numero,
      direcao: p.direcao,
      linha: p.linha,
      coluna: p.coluna,
      tamanho: p.resposta.length,
      dica: p.dica
    }))
    .sort((a, b) => a.numero - b.numero);

  return {
    grade: montarMatriz(
      { linhas: conteudo.grade.linhas, colunas: conteudo.grade.colunas, palavras: conteudo.palavras },
      { ocultarLetras: true }
    ),
    numeros: dicas.map(({ numero, linha, coluna }) => ({ numero, linha, coluna })),
    horizontais: dicas.filter((d) => d.direcao === 'horizontal'),
    verticais: dicas.filter((d) => d.direcao === 'vertical')
  };
}

/**
 * Ranking de uma cruzada: melhor partida finalizada de cada aluno,
 * ordenada por pontuacao e, no empate, pelo menor tempo (RN12).
 */
export async function rankingDaCruzada(idCruzada, limite = 10) {
  const { rows } = await pool.query(
    `SELECT * FROM (
        SELECT DISTINCT ON (s.id_aluno)
               s.id_aluno, u.nome, u.usertag, s.pontuacao::float AS pontuacao, s.tempo,
               s.acertos, s.tentativas, v.qtd_palavras, v.numero_versao, s.fim,
               (SELECT COUNT(*)::int FROM dica_sessao d WHERE d.id_sessao = s.id_sessao) AS dicas
          FROM sessao_jogo s
          JOIN versao_cruzada v ON v.id_versao = s.id_versao
          JOIN usuario u        ON u.id_usuario = s.id_aluno
         WHERE v.id_cruzada = $1 AND s.fim IS NOT NULL
         ORDER BY s.id_aluno, s.pontuacao DESC, s.tempo ASC
     ) melhores
     ORDER BY pontuacao DESC, tempo ASC
     LIMIT $2`,
    [idCruzada, limite]
  );
  return rows.map((r, i) => ({ posicao: i + 1, ...r }));
}

/** Jogo publicado na versao atual, sem respostas (RN11). */
export async function obterJogoParaAluno(idCruzada, idAluno) {
  const cab = await obterCabecalho(idCruzada);
  if (!cab || cab.status !== 'publicado' || !cab.versao_atual) {
    throw naoEncontrado('Jogo não encontrado ou não publicado.');
  }
  const conteudo = await obterConteudo(cab.versao_atual.id_versao);
  if (!conteudo) throw naoEncontrado('Conteúdo do jogo indisponível.');

  const { rows: sessoes } = await pool.query(
    `SELECT s.id_sessao, s.id_versao, v.numero_versao, s.inicio, s.fim, s.tempo,
            s.tentativas, s.acertos, s.erros, s.pontuacao::float AS pontuacao, v.qtd_palavras,
            (SELECT COUNT(*)::int FROM dica_sessao d WHERE d.id_sessao = s.id_sessao) AS dicas
       FROM sessao_jogo s
       JOIN versao_cruzada v ON v.id_versao = s.id_versao
      WHERE v.id_cruzada = $1 AND s.id_aluno = $2
      ORDER BY s.inicio DESC`,
    [idCruzada, idAluno]
  );
  // Partida em andamento na versao atual (para "continuar").
  const aberta = sessoes.find((s) => !s.fim && s.id_versao === cab.versao_atual.id_versao);

  return {
    id_cruzada: cab.id_cruzada,
    titulo: cab.titulo,
    descricao: cab.descricao,
    dificuldade: cab.dificuldade,
    codigo_acesso: cab.codigo_acesso,
    disciplina: cab.disciplina,
    autor_nome: cab.autor_nome,
    versao: cab.versao_atual.numero_versao,
    ...montarTabuleiro(conteudo),
    sessao_aberta: aberta?.id_sessao ?? null,
    minhas_sessoes: sessoes.filter((s) => s.fim),
    ranking: await rankingDaCruzada(idCruzada)
  };
}

/** Todas as partidas encerradas de uma cruzada (visao do professor). */
export async function partidasDaCruzada(idCruzada) {
  const { rows } = await pool.query(
    `SELECT s.id_sessao, u.nome, u.usertag, v.numero_versao, s.fim, s.tempo, s.tentativas,
            s.acertos, s.erros, v.qtd_palavras, s.pontuacao::float AS pontuacao,
            (SELECT COUNT(*)::int FROM dica_sessao d WHERE d.id_sessao = s.id_sessao) AS dicas
       FROM sessao_jogo s
       JOIN versao_cruzada v ON v.id_versao = s.id_versao
       JOIN usuario u        ON u.id_usuario = s.id_aluno
      WHERE v.id_cruzada = $1 AND s.fim IS NOT NULL
      ORDER BY s.fim DESC
      LIMIT 100`,
    [idCruzada]
  );
  return rows;
}
