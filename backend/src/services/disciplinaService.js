// ============================================================================
// Manter Disciplina (perfil administrador) e solicitacoes de disciplina nova.
// ============================================================================
import { pool, withTransaction } from '../db/postgres.js';
import { validacao, naoEncontrado, conflito } from './erros.js';

function prepararDisciplina(dados) {
  const nome = String(dados?.nome ?? '').trim();
  const codigo = String(dados?.codigo ?? '').trim().toUpperCase();
  const erros = [];
  if (!nome) erros.push('Informe o nome da disciplina.');
  if (nome.length > 100) erros.push('O nome passa de 100 caracteres.');
  if (!codigo) erros.push('Informe o código da disciplina.');
  if (!/^[A-Z0-9]{1,20}$/.test(codigo)) erros.push('O código deve ter até 20 letras/números, sem espaços.');
  if (erros.length) throw validacao(erros);
  return { nome, codigo };
}

// Codigo repetido vira 409 em vez de erro 500.
async function comCodigoUnico(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === '23505') throw conflito('Já existe uma disciplina com esse código.');
    throw err;
  }
}

/** Lista disciplinas. `apenasAtivas` = usado nos formularios de jogo e na busca. */
export async function listarDisciplinas({ apenasAtivas = false } = {}) {
  const { rows } = await pool.query(
    `SELECT d.id_disciplina, d.nome, d.codigo, d.ativa,
            (SELECT COUNT(*)::int FROM palavra_cruzada pc
              WHERE pc.id_disciplina = d.id_disciplina) AS total_cruzadas
       FROM disciplina d
      ${apenasAtivas ? 'WHERE d.ativa' : ''}
      ORDER BY d.nome`
  );
  return rows;
}

export async function criarDisciplina(dados) {
  const { nome, codigo } = prepararDisciplina(dados);
  return comCodigoUnico(async () => {
    const { rows } = await pool.query(
      `INSERT INTO disciplina (nome, codigo) VALUES ($1, $2)
       RETURNING id_disciplina, nome, codigo, ativa`,
      [nome, codigo]
    );
    return rows[0];
  });
}

export async function editarDisciplina(idDisciplina, dados) {
  const { nome, codigo } = prepararDisciplina(dados);
  const ativa = dados.ativa === undefined ? null : Boolean(dados.ativa);
  return comCodigoUnico(async () => {
    const { rows } = await pool.query(
      `UPDATE disciplina
          SET nome = $1, codigo = $2, ativa = COALESCE($3, ativa)
        WHERE id_disciplina = $4
        RETURNING id_disciplina, nome, codigo, ativa`,
      [nome, codigo, ativa, idDisciplina]
    );
    if (!rows[0]) throw naoEncontrado('Disciplina não encontrada.');
    return rows[0];
  });
}

/**
 * RN15 - Disciplina sem cruzadas e apagada; com cruzadas, so e desativada
 * (as cruzadas existentes continuam apontando para ela).
 */
export async function excluirDisciplina(idDisciplina) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT d.id_disciplina,
              (SELECT COUNT(*)::int FROM palavra_cruzada pc
                WHERE pc.id_disciplina = d.id_disciplina) AS total
         FROM disciplina d WHERE d.id_disciplina = $1 FOR UPDATE`,
      [idDisciplina]
    );
    if (!rows[0]) throw naoEncontrado('Disciplina não encontrada.');
    if (rows[0].total > 0) {
      await client.query('UPDATE disciplina SET ativa = FALSE WHERE id_disciplina = $1', [idDisciplina]);
      return { resultado: 'desativada', total_cruzadas: rows[0].total };
    }
    // Solicitacoes aprovadas que criaram esta disciplina perdem a referencia.
    await client.query(
      'UPDATE solicitacao_disciplina SET id_disciplina = NULL WHERE id_disciplina = $1',
      [idDisciplina]
    );
    await client.query('DELETE FROM disciplina WHERE id_disciplina = $1', [idDisciplina]);
    return { resultado: 'excluida' };
  });
}

// ---------------------------------------------------------------------------
// RN16 - Solicitacoes de disciplina (professor -> administrador)
// ---------------------------------------------------------------------------
const SELECT_SOLICITACAO = `
  SELECT s.id_solicitacao, s.nome, s.codigo_sugerido, s.justificativa, s.status,
         s.resposta_admin, s.data_solicitacao, s.data_resposta, s.id_disciplina,
         p.usertag AS professor_usertag, p.nome AS professor_nome,
         a.usertag AS admin_usertag
    FROM solicitacao_disciplina s
    JOIN usuario p ON p.id_usuario = s.id_professor
    LEFT JOIN usuario a ON a.id_usuario = s.id_admin`;

export async function solicitarDisciplina(idProfessor, dados) {
  const nome = String(dados?.nome ?? '').trim();
  const codigo = String(dados?.codigo_sugerido ?? '').trim().toUpperCase() || null;
  const justificativa = String(dados?.justificativa ?? '').trim() || null;
  const erros = [];
  if (!nome) erros.push('Informe o nome da disciplina.');
  if (nome.length > 100) erros.push('O nome passa de 100 caracteres.');
  if (codigo && !/^[A-Z0-9]{1,20}$/.test(codigo)) erros.push('O código deve ter até 20 letras/números.');
  if (erros.length) throw validacao(erros);

  const { rows } = await pool.query(
    `INSERT INTO solicitacao_disciplina (id_professor, nome, codigo_sugerido, justificativa)
     VALUES ($1, $2, $3, $4) RETURNING id_solicitacao`,
    [idProfessor, nome, codigo, justificativa]
  );
  return rows[0];
}

export async function listarSolicitacoes({ idProfessor = null, status = null } = {}) {
  const filtros = [];
  const params = [];
  if (idProfessor) {
    params.push(idProfessor);
    filtros.push(`s.id_professor = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filtros.push(`s.status = $${params.length}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${SELECT_SOLICITACAO} ${where}
     ORDER BY (s.status = 'pendente') DESC, s.data_solicitacao DESC`,
    params
  );
  return rows;
}

/**
 * Administrador responde uma solicitacao pendente.
 * Ao aprovar, a disciplina e criada (o admin pode ajustar nome/codigo).
 */
export async function responderSolicitacao(idSolicitacao, idAdmin, { aprovar, nome, codigo, resposta }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM solicitacao_disciplina WHERE id_solicitacao = $1 FOR UPDATE',
      [idSolicitacao]
    );
    const sol = rows[0];
    if (!sol) throw naoEncontrado('Solicitação não encontrada.');
    if (sol.status !== 'pendente') throw conflito('Esta solicitação já foi respondida.');

    let idDisciplina = null;
    if (aprovar) {
      const disc = prepararDisciplina({
        nome: nome ?? sol.nome,
        codigo: codigo ?? sol.codigo_sugerido
      });
      try {
        const { rows: [nova] } = await client.query(
          'INSERT INTO disciplina (nome, codigo) VALUES ($1, $2) RETURNING id_disciplina',
          [disc.nome, disc.codigo]
        );
        idDisciplina = nova.id_disciplina;
      } catch (err) {
        if (err.code === '23505') throw conflito('Já existe uma disciplina com esse código.');
        throw err;
      }
    }

    await client.query(
      `UPDATE solicitacao_disciplina
          SET status = $1, id_admin = $2, id_disciplina = $3,
              resposta_admin = $4, data_resposta = CURRENT_TIMESTAMP
        WHERE id_solicitacao = $5`,
      [aprovar ? 'aprovada' : 'recusada', idAdmin, idDisciplina,
       String(resposta ?? '').trim() || null, idSolicitacao]
    );
    return { status: aprovar ? 'aprovada' : 'recusada', id_disciplina: idDisciplina };
  });
}
