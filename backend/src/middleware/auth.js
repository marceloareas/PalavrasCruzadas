// Middlewares de controle de acesso.
import { obterUsuario } from '../services/usuarioService.js';

// Carrega o usuario logado (da sessao) em req.usuario e res.locals.usuario.
export async function carregarUsuario(req, res, next) {
  res.locals.usuario = null;
  req.usuario = null;
  const id = req.session?.idUsuario;
  if (id) {
    const usuario = await obterUsuario(id);
    if (usuario) {
      req.usuario = usuario;
      res.locals.usuario = usuario;
    }
  }
  next();
}

export function requireLogin(req, res, next) {
  if (!req.usuario) return res.redirect('/login');
  next();
}

// RN02/RN03/RN08: acoes de criacao/edicao/exclusao sao exclusivas de professor.
export function requireProfessor(req, res, next) {
  if (!req.usuario) return res.redirect('/login');
  if (req.usuario.papel !== 'professor') {
    return res.status(403).render('erro', {
      titulo: 'Acesso negado',
      mensagem: 'Apenas professores podem acessar esta area (RN02).'
    });
  }
  next();
}
