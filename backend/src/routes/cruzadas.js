// Cruzadas do professor (RN02/RN03/RN08) e busca de jogos do aluno.
import { Router } from 'express';
import { exigirPapel } from '../middleware/auth.js';
import {
  listarCruzadasDoAutor,
  estatisticasDoAutor,
  obterCruzada,
  criarCruzada,
  editarCruzada,
  excluirCruzada
} from '../services/cruzadaService.js';
import { buscarJogos, obterJogoParaAluno } from '../services/jogoService.js';
import { naoEncontrado, proibido } from '../services/erros.js';

const router = Router();
const professor = exigirPapel('professor');
const aluno = exigirPapel('aluno');
const id = (req) => Number.parseInt(req.params.id, 10);

// --- Professor --------------------------------------------------------------
router.get('/professor/cruzadas', professor, async (req, res) => {
  const [cruzadas, estatisticas] = await Promise.all([
    listarCruzadasDoAutor(req.usuario.id_usuario),
    estatisticasDoAutor(req.usuario.id_usuario)
  ]);
  res.json({ cruzadas, estatisticas });
});

router.post('/professor/cruzadas', professor, async (req, res) => {
  res.status(201).json(await criarCruzada({ idAutor: req.usuario.id_usuario, dados: req.body }));
});

// Detalhe com respostas: so o autor (RN11 - nem outro professor ve o gabarito).
router.get('/professor/cruzadas/:id', professor, async (req, res) => {
  const cruzada = await obterCruzada(id(req));
  if (!cruzada) throw naoEncontrado('Cruzada não encontrada.');
  if (cruzada.id_autor !== req.usuario.id_usuario) throw proibido('Esta cruzada é de outro professor.');
  res.json(cruzada);
});

router.put('/professor/cruzadas/:id', professor, async (req, res) => {
  res.json(await editarCruzada({ idCruzada: id(req), idAutor: req.usuario.id_usuario, dados: req.body }));
});

router.delete('/professor/cruzadas/:id', professor, async (req, res) => {
  await excluirCruzada({ idCruzada: id(req), idAutor: req.usuario.id_usuario });
  res.status(204).end();
});

// --- Aluno ------------------------------------------------------------------
router.get('/jogos', aluno, async (req, res) => {
  res.json(
    await buscarJogos({
      texto: req.query.texto,
      idDisciplina: req.query.disciplina,
      dificuldade: req.query.dificuldade,
      codigo: req.query.codigo,
      idAluno: req.usuario.id_usuario
    })
  );
});

router.get('/jogos/:id', aluno, async (req, res) => {
  res.json(await obterJogoParaAluno(id(req), req.usuario.id_usuario));
});

export default router;
