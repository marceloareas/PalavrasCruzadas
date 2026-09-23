// ============================================================================
// Integracao com o Ludica (provedor de identidade).
// O Ludica envia: id, usertag, email, papel.
// Aqui fazemos o "upsert" desse usuario no banco local e devolvemos o registro.
// ============================================================================
import { pool } from '../db.js';

const PAPEIS_VALIDOS = ['professor', 'aluno'];

/**
 * Sincroniza (cria ou atualiza) um usuario a partir do payload do Ludica.
 * @param {{id:number, usertag:string, email:string, papel:string, nome?:string}} ludica
 */
export async function sincronizarUsuarioLudica(ludica) {
  const id = Number.parseInt(ludica.id, 10);
  const usertag = String(ludica.usertag || '').trim();
  const email = String(ludica.email || '').trim().toLowerCase();
  const papel = String(ludica.papel || '').trim().toLowerCase();
  const nome = ludica.nome ? String(ludica.nome).trim() : usertag;

  if (!Number.isInteger(id)) throw new Error('Ludica: id invalido.');
  if (!usertag) throw new Error('Ludica: usertag obrigatorio.');
  if (!email) throw new Error('Ludica: email obrigatorio.');
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw new Error("Ludica: papel deve ser 'professor' ou 'aluno' (RN01).");
  }

  const { rows } = await pool.query(
    `INSERT INTO usuario (id_ludica, usertag, nome, email, papel)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_ludica) DO UPDATE
        SET usertag = EXCLUDED.usertag,
            nome    = EXCLUDED.nome,
            email   = EXCLUDED.email,
            papel   = EXCLUDED.papel
     RETURNING id_usuario, id_ludica, usertag, nome, email, papel`,
    [id, usertag, nome, email, papel]
  );
  return rows[0];
}

export async function listarUsuarios() {
  const { rows } = await pool.query(
    `SELECT id_usuario, id_ludica, usertag, nome, email, papel
       FROM usuario ORDER BY papel, usertag`
  );
  return rows;
}

export async function obterUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT id_usuario, id_ludica, usertag, nome, email, papel
       FROM usuario WHERE id_usuario = $1`,
    [idUsuario]
  );
  return rows[0] || null;
}
