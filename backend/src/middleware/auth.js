// ============================================================================
// Sessao e controle de acesso por papel (RN01/RN02).
//
// A autenticacao de verdade sera feita pelo Ludica (o sistema deve rodar
// dentro dele). Enquanto essa integracao nao esta definida, o login e
// simulado em routes/auth.js e a sessao guarda so o id do usuario local.
// Quando o Ludica estiver pronto, basta trocar `carregarUsuario` para ler o
// usuario do token/cabecalho enviado por ele.
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
