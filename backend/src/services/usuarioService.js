// ============================================================================
// Usuarios vem do Ludica (provedor de identidade). Nao ha cadastro nem senha
// aqui: o usuario chega pelo link do Ludica com perfil, email e gamertag
// (ver services/ludica.js) e e criado/atualizado pela gamertag.
// ============================================================================
import { pool } from '../db/postgres.js';
import { validacao, conflito } from './erros.js';

const CAMPOS = 'id_usuario, id_ludica, usertag, nome, email, papel';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entrada pelo Ludica: procura a gamertag; se nao existe, cria o usuario.
 * Se existe, atualiza email e papel - exceto administrador, que e definido
 * aqui (o Ludica so conhece professor e aluno) e nunca e rebaixado.
 * @param {{gamertag:string, email:string, papel:'professor'|'aluno'}} dados
 */
export async function entrarPeloLudica({ gamertag, email, papel }) {
  const tag = String(gamertag || '').trim();
  const mail = String(email || '').trim().toLowerCase();

  const erros = [];
  if (!tag || tag.length > 50) erros.push('gamertag inválida.');
  if (!EMAIL.test(mail) || mail.length > 150) erros.push('email inválido.');
  if (!['professor', 'aluno'].includes(papel)) erros.push('perfil inválido.');
  if (erros.length) throw validacao(erros, 'Dados do Lúdica inválidos.');

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuario (usertag, nome, email, papel)
       VALUES ($1, $1, $2, $3)
       ON CONFLICT (usertag) DO UPDATE
          SET email = EXCLUDED.email,
              papel = CASE WHEN usuario.papel = 'administrador' THEN usuario.papel
                           ELSE EXCLUDED.papel END
       RETURNING ${CAMPOS}`,
      [tag, mail, papel]
    );
    return rows[0];
  } catch (err) {
    // email UNIQUE: o mesmo email ja pertence a outra gamertag.
    if (err.code === '23505') throw conflito('Este email já está associado a outra gamertag.');
    throw err;
  }
}

export async function listarUsuarios() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuario ORDER BY papel, usertag`);
  return rows;
}

export async function obterUsuario(idUsuario) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuario WHERE id_usuario = $1`, [idUsuario]);
  return rows[0] || null;
}
