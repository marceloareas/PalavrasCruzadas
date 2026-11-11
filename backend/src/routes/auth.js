// ============================================================================
// Autenticacao. O unico jeito de entrar e pelo link do Ludica
// (GET /ludica). Nao existe cadastro nem senha na Cruzadinha.
//
// Em desenvolvimento (LOGIN_DEV) ficam disponiveis atalhos para testar sem o
// Ludica: "entrar como" um usuario ja existente e gerar um link valido.
// Em producao essas rotas respondem 404.
// ============================================================================
import { Router } from 'express';
import { listarUsuarios, obterUsuario, entrarPeloLudica } from '../services/usuarioService.js';
import { tokenValido, papelDoPerfil, linkDeEntrada } from '../services/ludica.js';
import { ErroNegocio } from '../services/erros.js';

const router = Router();

export const loginDevAtivo = () =>
  process.env.LOGIN_DEV ? process.env.LOGIN_DEV === 'true' : process.env.NODE_ENV !== 'production';

// Troca o id da sessao ao logar (evita fixacao de sessao).
function logar(req, idUsuario) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.idUsuario = idUsuario;
      resolve();
    });
  });
}

const negar = (res, motivo) => res.redirect(302, `/login?erro=${encodeURIComponent(motivo)}`);

// Link vindo do Ludica: ?perfil=&email=&gamertag=&token=
router.get('/ludica', async (req, res) => {
  const { perfil, email, gamertag, token } = req.query;
  if (![perfil, email, gamertag, token].every((v) => typeof v === 'string' && v.trim())) {
    return negar(res, 'dados');
  }
  if (!tokenValido(gamertag.trim(), token.trim())) return negar(res, 'token');
  const papel = papelDoPerfil(perfil);
  if (!papel) return negar(res, 'perfil');

  try {
    const usuario = await entrarPeloLudica({ gamertag, email, papel });
    await logar(req, usuario.id_usuario);
    res.redirect(302, '/');
  } catch (err) {
    if (err instanceof ErroNegocio) return negar(res, err.status === 409 ? 'email' : 'dados');
    throw err;
  }
});

router.get('/eu', (req, res) => {
  res.json(req.usuario);
});

// O front usa para decidir se mostra os atalhos de desenvolvimento e para
// onde aponta o botao "Ir para o Ludica".
router.get('/modo', (req, res) => {
  const dev = loginDevAtivo();
  res.json({
    login_dev: dev,
    url_ludica: process.env.LUDICA_URL_SITE || null,
    // numeros dos perfis, para o simulador de link (so em desenvolvimento)
    perfis: dev
      ? { professor: process.env.LUDICA_PERFIL_PROFESSOR || '1', aluno: process.env.LUDICA_PERFIL_ALUNO || '2' }
      : undefined
  });
});

router.post('/sair', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

// ---- Atalhos de desenvolvimento -------------------------------------------
const soDev = (req, res, next) =>
  loginDevAtivo() ? next() : res.status(404).json({ erro: 'Rota não encontrada.' });

router.get('/usuarios', soDev, async (req, res) => {
  res.json(await listarUsuarios());
});

router.post('/entrar', soDev, async (req, res) => {
  const usuario = await obterUsuario(Number.parseInt(req.body?.id_usuario, 10));
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  await logar(req, usuario.id_usuario);
  res.json(usuario);
});

// Gera o link que o Ludica geraria (para testar o fluxo de verdade).
router.post('/dev/link-ludica', soDev, (req, res) => {
  const { perfil, email, gamertag } = req.body ?? {};
  if (!process.env.LUDICA_SEGREDO) {
    return res.status(422).json({ erro: 'Defina LUDICA_SEGREDO para gerar links.' });
  }
  if (!gamertag || !email || perfil === undefined) {
    return res.status(422).json({ erro: 'Informe perfil, email e gamertag.' });
  }
  res.json({ url: linkDeEntrada({ perfil, email: String(email), gamertag: String(gamertag) }) });
});

export default router;
