// ============================================================================
// Cruzadas do professor: criar, editar (nova versao), excluir e consultar.
//
// Metadados e versoes ficam no PostgreSQL; palavras + grade de cada versao
// ficam no MongoDB (colecao conteudo_versao). Ver db/mongo/modelo.md.
// ============================================================================
import { pool, withTransaction } from '../db/postgres.js';
import { conteudoVersao } from '../db/mongo.js';
import { DIFICULDADES, STATUS_CRUZADA } from '../regras.js';
import { validarPalavras, gerarGrade, normalizarResposta, montarMatriz } from './gerador.js';
import { validacao, naoEncontrado, proibido, conflito } from './erros.js';

// Painel do professor: suas cruzadas com versao atual e numeros de uso.
export async function listarCruzadasDoAutor(idAutor) {
  const { rows } = await pool.query(
    `SELECT pc.id_cruzada, pc.titulo, pc.codigo_acesso, pc.dificuldade, pc.status,
            pc.data_atualizacao, d.nome AS disciplina,
            v.numero_versao AS versao_atual, v.qtd_palavras,
            (SELECT COUNT(*)::int FROM sessao_jogo s
               JOIN versao_cruzada vv ON vv.id_versao = s.id_versao
              WHERE vv.id_cruzada = pc.id_cruzada) AS resolucoes,
            (SELECT ROUND(AVG(s.tempo))::int FROM sessao_jogo s
               JOIN versao_cruzada vv ON vv.id_versao = s.id_versao
              WHERE vv.id_cruzada = pc.id_cruzada) AS tempo_medio
       FROM palavra_cruzada pc
       JOIN disciplina d ON d.id_disciplina = pc.id_disciplina
       LEFT JOIN LATERAL (
            SELECT numero_versao, qtd_palavras FROM versao_cruzada
             WHERE id_cruzada = pc.id_cruzada
             ORDER BY numero_versao DESC LIMIT 1) v ON TRUE
      WHERE pc.id_autor = $1
      ORDER BY pc.data_atualizacao DESC`,
    [idAutor]
  );
  return rows;
}

export async function estatisticasDoAutor(idAutor) {
  const { rows } = await pool.query(
    `SELECT
        (SELECT COUNT(*)::int FROM palavra_cruzada WHERE id_autor = $1) AS jogos_criados,
        (SELECT COUNT(DISTINCT s.id_aluno)::int
           FROM sessao_jogo s
           JOIN versao_cruzada v ON v.id_versao = s.id_versao
           JOIN palavra_cruzada pc ON pc.id_cruzada = v.id_cruzada
          WHERE pc.id_autor = $1) AS alunos_ativos,
        (SELECT ROUND(100.0 * SUM(s.acertos) / NULLIF(SUM(s.acertos + s.erros), 0))::int
           FROM sessao_jogo s
           JOIN versao_cruzada v ON v.id_versao = s.id_versao
           JOIN palavra_cruzada pc ON pc.id_cruzada = v.id_cruzada
          WHERE pc.id_autor = $1) AS media_acertos`,
    [idAutor]
  );
  return rows[0];
}

// Cabecalho + historico de versoes (PostgreSQL).
export async function obterCabecalho(idCruzada) {
  const { rows } = await pool.query(
    `SELECT pc.*, d.nome AS disciplina, d.codigo AS disciplina_codigo,
            u.usertag AS autor_usertag, u.nome AS autor_nome
       FROM palavra_cruzada pc
       JOIN disciplina d ON d.id_disciplina = pc.id_disciplina
       JOIN usuario u    ON u.id_usuario   = pc.id_autor
      WHERE pc.id_cruzada = $1`,
    [idCruzada]
  );
  if (!rows[0]) return null;
  const cruzada = rows[0];
  const { rows: versoes } = await pool.query(
    `SELECT v.id_versao, v.numero_versao, v.qtd_palavras, v.linhas, v.colunas, v.data_criacao,
            (SELECT COUNT(*)::int FROM sessao_jogo s WHERE s.id_versao = v.id_versao) AS sessoes
       FROM versao_cruzada v WHERE v.id_cruzada = $1
      ORDER BY v.numero_versao DESC`,
    [idCruzada]
  );
  cruzada.versoes = versoes;
  cruzada.versao_atual = versoes[0] || null;
  return cruzada;
}

// Conteudo de uma versao (MongoDB).
export async function obterConteudo(idVersao) {
  return conteudoVersao().findOne({ id_versao: idVersao }, { projection: { _id: 0 } });
}

/** Cruzada completa para o professor (com respostas e grade preenchida). */
export async function obterCruzada(idCruzada) {
  const cruzada = await obterCabecalho(idCruzada);
  if (!cruzada) return null;
  const conteudo = cruzada.versao_atual ? await obterConteudo(cruzada.versao_atual.id_versao) : null;
  cruzada.palavras = conteudo?.palavras ?? [];
  cruzada.matriz = conteudo
    ? montarMatriz({ linhas: conteudo.grade.linhas, colunas: conteudo.grade.colunas, palavras: conteudo.palavras })
    : [];
  return cruzada;
}

// ---------------------------------------------------------------------------
// Validacao dos dados do formulario
// ---------------------------------------------------------------------------
async function prepararDados(dados, { idDisciplinaAtual = null } = {}) {
  const erros = [];
  const titulo = String(dados?.titulo ?? '').trim();
  const descricao = String(dados?.descricao ?? '').trim() || null;
  const dificuldade = String(dados?.dificuldade ?? '');
  const status = String(dados?.status ?? 'rascunho');
  const idDisciplina = Number.parseInt(dados?.id_disciplina, 10);

  if (!titulo) erros.push('Informe o título.');
  if (titulo.length > 150) erros.push('O título passa de 150 caracteres.');
  if (!DIFICULDADES.includes(dificuldade)) erros.push('Dificuldade inválida (RN07).');
  if (!STATUS_CRUZADA.includes(status)) erros.push('Status inválido.');

  // RN04: exatamente uma disciplina, e ativa (a nao ser que ja fosse a atual).
  if (!Number.isInteger(idDisciplina)) {
    erros.push('Escolha a disciplina (RN04).');
  } else {
    const { rows } = await pool.query(
      'SELECT ativa, codigo FROM disciplina WHERE id_disciplina = $1',
      [idDisciplina]
    );
    if (!rows[0]) erros.push('Disciplina inexistente.');
    else if (!rows[0].ativa && idDisciplina !== idDisciplinaAtual) erros.push('Esta disciplina está desativada.');
  }

  const palavras = (Array.isArray(dados?.palavras) ? dados.palavras : [])
    .filter((p) => p && (String(p.resposta ?? '').trim() || String(p.dica ?? '').trim()))
    .map((p) => ({ resposta: normalizarResposta(p.resposta), dica: String(p.dica ?? '').trim() }));
  erros.push(...validarPalavras(palavras));

  if (erros.length) throw validacao(erros);
  return { titulo, descricao, dificuldade, status, idDisciplina, palavras };
}

// RN06/RN14: gera a grade ao salvar; recusa se alguma palavra nao encaixar.
function gerarOuRecusar(palavras) {
  const grade = gerarGrade(palavras);
  if (!grade.ok) {
    throw validacao(
      [`Não foi possível encaixar: ${grade.naoEncaixadas.join(', ')}. ` +
       'Troque por palavras que tenham letras em comum com as demais.'],
      'A grade não pode ser montada com essas palavras.'
    );
  }
  return grade;
}

async function gerarCodigoAcesso(client, prefixo) {
  for (let i = 0; i < 10; i++) {
    const codigo = `${prefixo}-${Math.floor(10000 + Math.random() * 90000)}`;
    const { rows } = await client.query('SELECT 1 FROM palavra_cruzada WHERE codigo_acesso = $1', [codigo]);
    if (rows.length === 0) return codigo;
  }
  return `${prefixo}-${Date.now().toString().slice(-6)}`;
}

/**
 * Cria a versao no Postgres e o conteudo no Mongo, sem transacao distribuida:
 * se o Mongo falhar o Postgres faz rollback; se o COMMIT falhar o documento
 * do Mongo e apagado.
 */
async function salvarComNovaVersao(fnCabecalho, grade) {
  let idVersaoMongo = null;
  try {
    return await withTransaction(async (client) => {
      const { idCruzada, numeroVersao } = await fnCabecalho(client);
      const { rows: [versao] } = await client.query(
        `INSERT INTO versao_cruzada (id_cruzada, numero_versao, qtd_palavras, linhas, colunas)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_versao`,
        [idCruzada, numeroVersao, grade.palavras.length, grade.linhas, grade.colunas]
      );
      await conteudoVersao().insertOne({
        id_versao: versao.id_versao,
        id_cruzada: idCruzada,
        grade: { linhas: grade.linhas, colunas: grade.colunas },
        palavras: grade.palavras.map((p) => ({
          indice: p.indice,
          numero: p.numero,
          resposta: p.resposta,
          dica: p.dica,
          linha: p.linha,
          coluna: p.coluna,
          direcao: p.direcao
        })),
        criado_em: new Date()
      });
      idVersaoMongo = versao.id_versao;
      return { idCruzada, numeroVersao, idVersao: versao.id_versao };
    });
  } catch (err) {
    if (idVersaoMongo !== null) {
      await conteudoVersao().deleteOne({ id_versao: idVersaoMongo }).catch(() => {});
    }
    throw err;
  }
}

/** Cria uma cruzada (versao 1). O professor envia so respostas + dicas. */
export async function criarCruzada({ idAutor, dados }) {
  const d = await prepararDados(dados);
  const grade = gerarOuRecusar(d.palavras);

  return salvarComNovaVersao(async (client) => {
    const { rows: [disc] } = await client.query(
      'SELECT codigo FROM disciplina WHERE id_disciplina = $1', [d.idDisciplina]
    );
    const codigo = await gerarCodigoAcesso(client, disc.codigo);
    const { rows: [cruzada] } = await client.query(
      `INSERT INTO palavra_cruzada
         (id_autor, id_disciplina, titulo, codigo_acesso, descricao, dificuldade, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_cruzada`,
      [idAutor, d.idDisciplina, d.titulo, codigo, d.descricao, d.dificuldade, d.status]
    );
    return { idCruzada: cruzada.id_cruzada, numeroVersao: 1 };
  }, grade);
}

async function obterDoAutor(idCruzada, idAutor, acao) {
  const cruzada = await obterCabecalho(idCruzada);
  if (!cruzada) throw naoEncontrado('Cruzada não encontrada.');
  if (cruzada.id_autor !== idAutor) {
    throw proibido(`Apenas o professor autor pode ${acao} esta cruzada (RN03/RN08).`);
  }
  return cruzada;
}

const mesmasPalavras = (a, b) =>
  a.length === b.length && a.every((p, i) => p.resposta === b[i].resposta && p.dica === b[i].dica);

/**
 * Edita uma cruzada (RN08: apenas o autor).
 * RN09: se as palavras mudaram, cria uma NOVA versao (com grade nova) e as
 * sessoes antigas continuam ligadas a versao que foi jogada. Se so os
 * metadados mudaram, atualiza o cabecalho sem criar versao.
 */
export async function editarCruzada({ idCruzada, idAutor, dados }) {
  const atual = await obterDoAutor(idCruzada, idAutor, 'editar');
  const d = await prepararDados(dados, { idDisciplinaAtual: atual.id_disciplina });

  const conteudoAtual = atual.versao_atual ? await obterConteudo(atual.versao_atual.id_versao) : null;
  const palavrasAtuais = [...(conteudoAtual?.palavras ?? [])].sort((a, b) => a.indice - b.indice);
  const novaVersao = !mesmasPalavras(d.palavras, palavrasAtuais);
  const grade = novaVersao ? gerarOuRecusar(d.palavras) : null;

  const atualizarCabecalho = (client) =>
    client.query(
      `UPDATE palavra_cruzada
          SET titulo = $1, descricao = $2, dificuldade = $3, id_disciplina = $4,
              status = $5, data_atualizacao = CURRENT_TIMESTAMP
        WHERE id_cruzada = $6`,
      [d.titulo, d.descricao, d.dificuldade, d.idDisciplina, d.status, idCruzada]
    );

  if (!novaVersao) {
    await atualizarCabecalho(pool);
    return { idCruzada, numeroVersao: atual.versao_atual?.numero_versao ?? null, novaVersao: false };
  }

  const r = await salvarComNovaVersao(async (client) => {
    await atualizarCabecalho(client);
    const { rows: [{ prox }] } = await client.query(
      `SELECT COALESCE(MAX(numero_versao), 0) + 1 AS prox
         FROM versao_cruzada WHERE id_cruzada = $1`,
      [idCruzada]
    );
    return { idCruzada, numeroVersao: prox };
  }, grade);
  return { ...r, novaVersao: true };
}

/**
 * Exclui a cruzada (RN03: apenas o autor). Se alunos ja jogaram, a exclusao
 * apagaria o historico das sessoes (RN09/RN12), entao o professor deve
 * arquivar em vez de excluir.
 */
export async function excluirCruzada({ idCruzada, idAutor }) {
  const cruzada = await obterDoAutor(idCruzada, idAutor, 'excluir');
  const sessoes = cruzada.versoes.reduce((t, v) => t + v.sessoes, 0);
  if (sessoes > 0) {
    throw conflito(
      `Esta cruzada já tem ${sessoes} partida(s) registradas. ` +
      'Para preservar o histórico dos alunos, altere o status para "arquivado".'
    );
  }
  await pool.query('DELETE FROM palavra_cruzada WHERE id_cruzada = $1', [idCruzada]);
  await conteudoVersao().deleteMany({ id_cruzada: idCruzada });
}
