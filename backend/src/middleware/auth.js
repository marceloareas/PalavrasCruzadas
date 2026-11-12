// ============================================================================
// Sessao e controle de acesso por papel (RN01/RN02).
//
// O login e feito pela entrada do Ludica (routes/auth.js, POST /ludica); depois
// disso a sessao guarda so o id do usuario local.
// ============================================================================
import { obterUsuario } from '../services/usuarioService.js';

export async function carregarUsuario(req, res, next) {
  req.usuario = null;
  const id = req.session?.idUsuario;
  if (id) req.usuario = await obterUsuario(id);
  next();
}

export function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
    if (papeis.length && !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: `Acesso restrito a: ${papeis.join(', ')}.` });
    }
    next();
  };
}

export const exigirLogin = exigirPapel();
