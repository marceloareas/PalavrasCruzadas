// Login simulado enquanto a integracao com o Ludica nao esta definida.
import { Router } from 'express';
import { listarUsuarios, obterUsuario, sincronizarUsuarioLudica } from '../services/usuarioService.js';

const router = Router();

// Usuarios ja sincronizados (tela "entrar como").
router.get('/usuarios', async (req, res) => {
  res.json(await listarUsuarios());
});

router.get('/eu', (req, res) => {
  res.json(req.usuario);
});

// "Entrar como" um usuario existente (atalho de desenvolvimento).
router.post('/entrar', async (req, res) => {
  const usuario = await obterUsuario(Number.parseInt(req.body?.id_usuario, 10));
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  req.session.idUsuario = usuario.id_usuario;
  res.json(usuario);
});

// Simula o Ludica enviando { id, usertag, email, papel }: faz upsert e loga.
router.post('/ludica', async (req, res) => {
  const usuario = await sincronizarUsuarioLudica(req.body ?? {});
  req.session.idUsuario = usuario.id_usuario;
  res.json(usuario);
});

router.post('/sair', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

export default router;
