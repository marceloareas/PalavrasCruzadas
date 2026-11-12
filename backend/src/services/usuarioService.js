// ============================================================================
// Usuarios vem do Ludica (provedor de identidade). Nao ha cadastro nem senha
// aqui: o usuario chega pelo POST de entrada do Ludica com tipo_usuario,
// email, gamertag e url_retorno (ver services/ludica.js) e e criado ou
// atualizado pela gamertag.
// ============================================================================
import { pool } from '../db/postgres.js';
import { validacao, conflito } from './erros.js';

const CAMPOS = 'id_usuario, id_ludica, usertag, nome, email, papel';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entrada pelo Ludica: procura a gamertag; se nao existe, cria o usuario.
 * Se existe, atualiza email, papel e url_retorno - o papel de administrador
 * e definido so aqui (o Ludica nao cria administrador da Cruzadinha) e nunca
 * e rebaixado.
 * @param {{gamertag:string, email:string, papel:'professor'|'aluno', urlRetorno:string}} dados
 */
export async function entrarPeloLudica({ gamertag, email, papel, urlRetorno }) {
  const tag = String(gamertag || '').trim();
  const mail = String(email || '').trim().toLowerCase();

  const erros = [];
  if (!tag || tag.length > 50) erros.push('gamertag inválida.');
  if (!EMAIL.test(mail) || mail.length > 150) erros.push('email inválido.');
  if (!['professor', 'aluno'].includes(papel)) erros.push('tipo_usuario inválido.');
  if (!urlRetorno || String(urlRetorno).length > 500) erros.push('url_retorno inválida.');
  if (erros.length) throw validacao(erros, 'Dados do Lúdica inválidos.');

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuario (usertag, nome, email, papel, ludica_url_retorno)
       VALUES ($1, $1, $2, $3, $4)
       ON CONFLICT (usertag) DO UPDATE
          SET email = EXCLUDED.email,
              ludica_url_retorno = EXCLUDED.ludica_url_retorno,
              papel = CASE WHEN usuario.papel = 'administrador' THEN usuario.papel
                           ELSE EXCLUDED.papel END
       RETURNING ${CAMPOS}`,
      [tag, mail, papel, urlRetorno]
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
