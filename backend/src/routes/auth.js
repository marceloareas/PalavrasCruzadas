// ============================================================================
// Autenticacao. O unico jeito de entrar e pelo Ludica, que abre o jogo com um
// POST de formulario (POST /ludica). Nao existe cadastro nem senha aqui.
//
// Em desenvolvimento (LOGIN_DEV) ficam disponiveis atalhos para testar sem o
// Ludica: "entrar como" um usuario ja existente e simular a entrada do
// Ludica. Em producao essas rotas respondem 404.
// ============================================================================
import { Router } from 'express';
import { listarUsuarios, obterUsuario, entrarPeloLudica } from '../services/usuarioService.js';
import {
  hashEntradaValido, papelDoTipo, urlRetornoValida, camposDeEntrada, configLudica
} from '../services/ludica.js';
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

// 303: o navegador segue com GET para a tela de entrada, que mostra o motivo.
const negar = (res, motivo) => res.redirect(303, `/login?erro=${encodeURIComponent(motivo)}`);

// Entrada vinda do Ludica: POST de formulario com
// tipo_usuario, email, gamertag, hash, jogo, data e url_retorno.
// O hash e conferido com o NOSSO nome de jogo e a NOSSA data de hoje
// (os campos jogo e data recebidos nao sao usados para isso).
router.post('/ludica', async (req, res) => {
  const { tipo_usuario: tipo, email, gamertag, hash, url_retorno: urlRetorno } = req.body ?? {};
  if (![tipo, email, gamertag, hash, urlRetorno].every((v) => typeof v === 'string' && v.trim())) {
    return negar(res, 'dados');
  }
  if (!hashEntradaValido(gamertag.trim(), hash.trim())) return negar(res, 'token');
  const papel = papelDoTipo(tipo);
  if (!papel) return negar(res, 'perfil');
  if (!urlRetornoValida(urlRetorno.trim())) return negar(res, 'dados');

  try {
    const usuario = await entrarPeloLudica({ gamertag, email, papel, urlRetorno: urlRetorno.trim() });
    await logar(req, usuario.id_usuario);
    res.redirect(303, '/');
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
    // url_retorno sugerido no simulador (o ludica-mock), so em desenvolvimento
    url_retorno_dev: dev ? urlRetornoDev() : undefined
  });
});

const urlRetornoDev = () =>
  process.env.LUDICA_URL_RETORNO_DEV || 'http://localhost:4000/integracao/resultados';

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

// Gera os campos que o Ludica mandaria na entrada; o front monta o
// formulario e faz o POST para /api/auth/ludica (o fluxo de verdade).
router.post('/dev/entrada-ludica', soDev, (req, res) => {
  const { tipo_usuario, email, gamertag, url_retorno } = req.body ?? {};
  if (!gamertag || !email || !tipo_usuario) {
    return res.status(422).json({ erro: 'Informe tipo_usuario, email e gamertag.' });
  }
  res.json({
    acao: '/api/auth/ludica',
    jogo: configLudica().nomeJogo,
    campos: camposDeEntrada({
      tipo_usuario: String(tipo_usuario),
      email: String(email),
      gamertag: String(gamertag),
      url_retorno: String(url_retorno || urlRetornoDev())
    })
  });
});

export default router;
