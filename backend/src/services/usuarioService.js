// ============================================================================
// Integracao com o Ludica (provedor de identidade).
// O Ludica envia: id, usertag, email, papel.
// Aqui fazemos o "upsert" desse usuario no banco local e devolvemos o registro.
// ============================================================================
import { pool } from '../db/postgres.js';
import { PAPEIS } from '../regras.js';
import { validacao } from './erros.js';

const CAMPOS = 'id_usuario, id_ludica, usertag, nome, email, papel';

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

  const erros = [];
  if (!Number.isInteger(id)) erros.push('id inválido.');
  if (!usertag) erros.push('usertag obrigatório.');
  if (!email) erros.push('email obrigatório.');
  if (!PAPEIS.includes(papel)) erros.push(`papel deve ser ${PAPEIS.join(', ')} (RN01).`);
  if (erros.length) throw validacao(erros, 'Payload do Lúdica inválido.');

  const { rows } = await pool.query(
    `INSERT INTO usuario (id_ludica, usertag, nome, email, papel)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_ludica) DO UPDATE
        SET usertag = EXCLUDED.usertag,
            nome    = EXCLUDED.nome,
            email   = EXCLUDED.email,
            papel   = EXCLUDED.papel
     RETURNING ${CAMPOS}`,
    [id, usertag, nome, email, papel]
  );
  return rows[0];
}

export async function listarUsuarios() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuario ORDER BY papel, usertag`);
  return rows;
}

export async function obterUsuario(idUsuario) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuario WHERE id_usuario = $1`, [idUsuario]);
  return rows[0] || null;
}
