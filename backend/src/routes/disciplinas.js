// Manter Disciplina (administrador) + solicitacoes de disciplina (RN16).
import { Router } from 'express';
import { exigirLogin, exigirPapel } from '../middleware/auth.js';
import {
  listarDisciplinas,
  criarDisciplina,
  editarDisciplina,
  excluirDisciplina,
  solicitarDisciplina,
  listarSolicitacoes,
  responderSolicitacao
} from '../services/disciplinaService.js';

const router = Router();
const admin = exigirPapel('administrador');
const id = (req) => Number.parseInt(req.params.id, 10);

// Qualquer usuario logado ve as ativas; o admin ve todas.
router.get('/disciplinas', exigirLogin, async (req, res) => {
  const todas = req.usuario.papel === 'administrador' && req.query.todas === '1';
  res.json(await listarDisciplinas({ apenasAtivas: !todas }));
});
router.post('/disciplinas', admin, async (req, res) => {
  res.status(201).json(await criarDisciplina(req.body));
});
router.put('/disciplinas/:id', admin, async (req, res) => {
  res.json(await editarDisciplina(id(req), req.body));
});
router.delete('/disciplinas/:id', admin, async (req, res) => {
  res.json(await excluirDisciplina(id(req)));
});

// Professor ve as proprias solicitacoes; admin ve todas.
router.get('/solicitacoes', exigirPapel('professor', 'administrador'), async (req, res) => {
  const ehAdmin = req.usuario.papel === 'administrador';
  res.json(
    await listarSolicitacoes({
      idProfessor: ehAdmin ? null : req.usuario.id_usuario,
      status: req.query.status || null
    })
  );
});
router.post('/solicitacoes', exigirPapel('professor'), async (req, res) => {
  res.status(201).json(await solicitarDisciplina(req.usuario.id_usuario, req.body));
});
router.post('/solicitacoes/:id/responder', admin, async (req, res) => {
  const b = req.body ?? {};
  res.json(
    await responderSolicitacao(id(req), req.usuario.id_usuario, {
      aprovar: Boolean(b.aprovar),
      nome: b.nome,
      codigo: b.codigo,
      resposta: b.resposta
    })
  );
});

export default router;
