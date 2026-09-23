// ============================================================================
// Regras de persistencia das palavras cruzadas (fluxo do professor).
// ============================================================================
import { pool, withTransaction } from '../db.js';
import { validarGrade, normalizarResposta } from './gridValidator.js';

export class ValidacaoError extends Error {
  constructor(erros) {
    super('Falha de validacao da cruzada.');
    this.name = 'ValidacaoError';
    this.erros = erros;
  }
}
export class PermissaoError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'PermissaoError';
  }
}

// Lista disciplinas (para o dropdown do formulario).
export async function listarDisciplinas() {
  const { rows } = await pool.query(
    'SELECT id_disciplina, nome, codigo FROM disciplina ORDER BY nome'
  );
  return rows;
}

// Lista as cruzadas de um autor (professor), com disciplina, versao atual,
// codigo de acesso, numero de resolucoes e tempo medio (para o Painel).
export async function listarCruzadasDoAutor(idAutor) {
  const { rows } = await pool.query(
    `SELECT pc.id_cruzada, pc.titulo, pc.codigo_acesso, pc.dificuldade, pc.status,
            pc.data_atualizacao,
            d.nome AS disciplina,
            (SELECT MAX(numero_versao) FROM versao_cruzada v
              WHERE v.id_cruzada = pc.id_cruzada) AS versao_atual,
            (SELECT COUNT(*) FROM palavra p
               JOIN versao_cruzada v ON v.id_versao = p.id_versao
              WHERE v.id_cruzada = pc.id_cruzada
                AND v.numero_versao = (SELECT MAX(numero_versao)
                                         FROM versao_cruzada v2
                                        WHERE v2.id_cruzada = pc.id_cruzada)
            ) AS total_palavras,
            (SELECT COUNT(*) FROM sessao_jogo s
               JOIN versao_cruzada v ON v.id_versao = s.id_versao
              WHERE v.id_cruzada = pc.id_cruzada) AS resolucoes,
            (SELECT ROUND(AVG(s.tempo)) FROM sessao_jogo s
               JOIN versao_cruzada v ON v.id_versao = s.id_versao
              WHERE v.id_cruzada = pc.id_cruzada) AS tempo_medio
       FROM palavra_cruzada pc
       JOIN disciplina d ON d.id_disciplina = pc.id_disciplina
      WHERE pc.id_autor = $1
      ORDER BY pc.data_atualizacao DESC`,
    [idAutor]
  );
  return rows;
}

// Estatisticas do Painel Docente (cabecalho com 3 tiles).
export async function estatisticasDoAutor(idAutor) {
  const { rows } = await pool.query(
    `SELECT
        (SELECT COUNT(*) FROM palavra_cruzada WHERE id_autor = $1) AS jogos_criados,
        (SELECT COUNT(DISTINCT s.id_aluno)
           FROM sessao_jogo s
           JOIN versao_cruzada v ON v.id_versao = s.id_versao
           JOIN palavra_cruzada pc ON pc.id_cruzada = v.id_cruzada
          WHERE pc.id_autor = $1) AS alunos_ativos,
        (SELECT ROUND(100.0 * SUM(s.acertos) /
                      NULLIF(SUM(s.acertos + s.erros), 0))
           FROM sessao_jogo s
           JOIN versao_cruzada v ON v.id_versao = s.id_versao
           JOIN palavra_cruzada pc ON pc.id_cruzada = v.id_cruzada
          WHERE pc.id_autor = $1) AS media_acertos`,
    [idAutor]
  );
  return rows[0];
}

// Gera um codigo de acesso legivel e unico (ex.: CSD-48291).
async function gerarCodigoAcesso(client, prefixo = 'CSD') {
  for (let i = 0; i < 10; i++) {
    const num = Math.floor(10000 + Math.random() * 90000);
    const codigo = `${prefixo}-${num}`;
    const { rows } = await client.query(
      'SELECT 1 FROM palavra_cruzada WHERE codigo_acesso = $1', [codigo]
    );
    if (rows.length === 0) return codigo;
  }
  return `${prefixo}-${Date.now().toString().slice(-6)}`;
}

// Carrega uma cruzada completa (cabecalho + versao mais recente + palavras).
export async function obterCruzada(idCruzada) {
  const { rows: cab } = await pool.query(
    `SELECT pc.*, d.nome AS disciplina, d.codigo AS disciplina_codigo,
            u.usertag AS autor_usertag, u.nome AS autor_nome
       FROM palavra_cruzada pc
       JOIN disciplina d ON d.id_disciplina = pc.id_disciplina
       JOIN usuario u    ON u.id_usuario   = pc.id_autor
      WHERE pc.id_cruzada = $1`,
    [idCruzada]
  );
  if (cab.length === 0) return null;
  const cruzada = cab[0];

  const { rows: versoes } = await pool.query(
    `SELECT id_versao, numero_versao, data_criacao
       FROM versao_cruzada WHERE id_cruzada = $1
      ORDER BY numero_versao DESC`,
    [idCruzada]
  );
  cruzada.versoes = versoes;
  const versaoAtual = versoes[0];
  cruzada.versao_atual = versaoAtual;

  if (versaoAtual) {
    const { rows: palavras } = await pool.query(
      `SELECT id_palavra, resposta, dica, linha, coluna, direcao
         FROM palavra WHERE id_versao = $1
        ORDER BY id_palavra`,
      [versaoAtual.id_versao]
    );
    cruzada.palavras = palavras;
  } else {
    cruzada.palavras = [];
  }
  return cruzada;
}

// Sanitiza a lista de palavras vinda do formulario.
function prepararPalavras(palavras) {
  return (palavras || [])
    .filter((p) => p && (p.resposta || '').trim() !== '')
    .map((p) => ({
      resposta: normalizarResposta(p.resposta),
      dica: String(p.dica ?? '').trim(),
      linha: Number.parseInt(p.linha, 10),
      coluna: Number.parseInt(p.coluna, 10),
      direcao: String(p.direcao ?? '').trim()
    }));
}

/**
 * Cria uma cruzada nova (versao 1) e persiste as palavras.
 * RN02/RN06: valida a grade ao salvar; RN04: uma disciplina por cruzada.
 */
export async function criarCruzada({ idAutor, dados }) {
  const palavras = prepararPalavras(dados.palavras);
  const { valido, erros } = validarGrade(palavras);
  if (!valido) throw new ValidacaoError(erros);

  return withTransaction(async (client) => {
    const codigo = await gerarCodigoAcesso(client);
    const { rows: [cruzada] } = await client.query(
      `INSERT INTO palavra_cruzada
         (id_autor, id_disciplina, titulo, codigo_acesso, descricao, dificuldade, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_cruzada`,
      [
        idAutor,
        Number.parseInt(dados.id_disciplina, 10),
        dados.titulo.trim(),
        codigo,
        (dados.descricao || '').trim() || null,
        dados.dificuldade,
        dados.status || 'rascunho'
      ]
    );

    const { rows: [versao] } = await client.query(
      `INSERT INTO versao_cruzada (id_cruzada, numero_versao)
       VALUES ($1, 1) RETURNING id_versao`,
      [cruzada.id_cruzada]
    );

    await inserirPalavras(client, versao.id_versao, palavras);
    return cruzada.id_cruzada;
  });
}

/**
 * Edita uma cruzada. RN08: apenas o autor. RN09: NAO altera a versao antiga;
 * cria uma NOVA versao com as palavras editadas, preservando o historico das
 * sessoes ja jogadas (que continuam apontando para a versao anterior).
 */
export async function editarCruzada({ idCruzada, idAutor, dados }) {
  const cruzada = await obterCruzada(idCruzada);
  if (!cruzada) throw new PermissaoError('Cruzada nao encontrada.');
  if (cruzada.id_autor !== idAutor) {
    throw new PermissaoError('Apenas o professor autor pode editar esta cruzada (RN08).');
  }

  const palavras = prepararPalavras(dados.palavras);
  const { valido, erros } = validarGrade(palavras);
  if (!valido) throw new ValidacaoError(erros);

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE palavra_cruzada
          SET titulo = $1, descricao = $2, dificuldade = $3,
              id_disciplina = $4, status = $5,
              data_atualizacao = CURRENT_TIMESTAMP
        WHERE id_cruzada = $6`,
      [
        dados.titulo.trim(),
        (dados.descricao || '').trim() || null,
        dados.dificuldade,
        Number.parseInt(dados.id_disciplina, 10),
        dados.status || cruzada.status,
        idCruzada
      ]
    );

    const { rows: [{ prox }] } = await client.query(
      `SELECT COALESCE(MAX(numero_versao), 0) + 1 AS prox
         FROM versao_cruzada WHERE id_cruzada = $1`,
      [idCruzada]
    );
    const { rows: [versao] } = await client.query(
      `INSERT INTO versao_cruzada (id_cruzada, numero_versao)
       VALUES ($1, $2) RETURNING id_versao`,
      [idCruzada, prox]
    );

    await inserirPalavras(client, versao.id_versao, palavras);
    return { idCruzada, numeroVersao: prox };
  });
}

// RN03/RN08: apenas o autor pode excluir.
export async function excluirCruzada({ idCruzada, idAutor }) {
  const { rows } = await pool.query(
    'SELECT id_autor FROM palavra_cruzada WHERE id_cruzada = $1',
    [idCruzada]
  );
  if (rows.length === 0) throw new PermissaoError('Cruzada nao encontrada.');
  if (rows[0].id_autor !== idAutor) {
    throw new PermissaoError('Apenas o professor autor pode excluir esta cruzada (RN03).');
  }
  await pool.query('DELETE FROM palavra_cruzada WHERE id_cruzada = $1', [idCruzada]);
}

async function inserirPalavras(client, idVersao, palavras) {
  for (const p of palavras) {
    await client.query(
      `INSERT INTO palavra (id_versao, resposta, dica, linha, coluna, direcao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idVersao, p.resposta, p.dica, p.linha, p.coluna, p.direcao]
    );
  }
}
