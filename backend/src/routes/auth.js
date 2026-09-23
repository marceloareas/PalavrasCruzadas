// Rotas de autenticacao (simulacao do handoff com o Ludica).
import { Router } from 'express';
import { listarUsuarios, sincronizarUsuarioLudica } from '../services/usuarioService.js';

const router = Router();

// Tela de login: lista os usuarios existentes ("entrar como") e permite
// simular o recebimento de um payload do Ludica.
router.get('/login', async (req, res) => {
  const usuarios = await listarUsuarios();
  res.render('login', { usuarios, erro: null });
});

// "Entrar como" um usuario ja existente (atalho de desenvolvimento).
router.post('/login', async (req, res) => {
  const idUsuario = Number.parseInt(req.body.id_usuario, 10);
  if (Number.isInteger(idUsuario)) {
    req.session.idUsuario = idUsuario;
  }
  res.redirect('/');
});

// Simula o Ludica enviando { id, usertag, email, papel }: faz upsert e loga.
router.post('/auth/ludica', async (req, res) => {
  try {
    const usuario = await sincronizarUsuarioLudica({
      id: req.body.id,
      usertag: req.body.usertag,
      email: req.body.email,
      papel: req.body.papel,
      nome: req.body.nome
    });
    req.session.idUsuario = usuario.id_usuario;
    res.redirect('/');
  } catch (err) {
    const usuarios = await listarUsuarios();
    res.status(400).render('login', { usuarios, erro: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

export default router;
