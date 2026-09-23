// Rotas do fluxo do professor: cadastrar/editar/excluir palavras cruzadas.
import { Router } from 'express';
import { requireProfessor } from '../middleware/auth.js';
import {
  listarDisciplinas,
  listarCruzadasDoAutor,
  estatisticasDoAutor,
  obterCruzada,
  criarCruzada,
  editarCruzada,
  excluirCruzada,
  ValidacaoError,
  PermissaoError
} from '../services/cruzadaService.js';
import { montarMatriz } from '../services/gridValidator.js';

const router = Router();

// Converte os campos do formulario (arrays paralelos) em lista de palavras.
function extrairPalavras(body) {
  const respostas = [].concat(body['resposta'] || []);
  const dicas = [].concat(body['dica'] || []);
  const linhas = [].concat(body['linha'] || []);
  const colunas = [].concat(body['coluna'] || []);
  const direcoes = [].concat(body['direcao'] || []);
  const palavras = [];
  for (let i = 0; i < respostas.length; i++) {
    palavras.push({
      resposta: respostas[i],
      dica: dicas[i],
      linha: linhas[i],
      coluna: colunas[i],
      direcao: direcoes[i]
    });
  }
  return palavras;
}

// Painel Docente: estatisticas + jogos da turma do professor logado.
router.get('/cruzadas', requireProfessor, async (req, res) => {
  const [cruzadas, stats] = await Promise.all([
    listarCruzadasDoAutor(req.usuario.id_usuario),
    estatisticasDoAutor(req.usuario.id_usuario)
  ]);
  res.render('cruzadas/lista', { cruzadas, stats });
});

// Formulario de nova cruzada.
router.get('/cruzadas/nova', requireProfessor, async (req, res) => {
  const disciplinas = await listarDisciplinas();
  res.render('cruzadas/form', {
    modo: 'criar',
    disciplinas,
    cruzada: { titulo: '', descricao: '', dificuldade: 'facil', status: 'rascunho', id_disciplina: '' },
    palavras: [
      { resposta: '', dica: '', linha: 1, coluna: 1, direcao: 'horizontal' },
      { resposta: '', dica: '', linha: 1, coluna: 1, direcao: 'vertical' }
    ],
    erros: [],
    avisos: []
  });
});

// Cria a cruzada (persiste no banco). RN06: valida a grade ao salvar.
router.post('/cruzadas', requireProfessor, async (req, res) => {
  const dados = {
    titulo: req.body.titulo,
    descricao: req.body.descricao,
    dificuldade: req.body.dificuldade,
    status: req.body.status,
    id_disciplina: req.body.id_disciplina,
    palavras: extrairPalavras(req.body)
  };
  try {
    const idCruzada = await criarCruzada({ idAutor: req.usuario.id_usuario, dados });
    res.redirect(`/cruzadas/${idCruzada}?criada=1`);
  } catch (err) {
    if (err instanceof ValidacaoError) {
      const disciplinas = await listarDisciplinas();
      return res.status(422).render('cruzadas/form', {
        modo: 'criar',
        disciplinas,
        cruzada: dados,
        palavras: dados.palavras,
        erros: err.erros,
        avisos: []
      });
    }
    throw err;
  }
});

// Detalhe de uma cruzada (com pre-visualizacao da grade).
router.get('/cruzadas/:id', requireProfessor, async (req, res) => {
  const cruzada = await obterCruzada(Number.parseInt(req.params.id, 10));
  if (!cruzada) {
    return res.status(404).render('erro', { titulo: 'Nao encontrada', mensagem: 'Cruzada inexistente.' });
  }
  const matriz = montarMatriz(cruzada.palavras);
  res.render('cruzadas/detalhe', {
    cruzada,
    matriz,
    ehAutor: cruzada.id_autor === req.usuario.id_usuario,
    criada: req.query.criada === '1',
    atualizada: req.query.atualizada
  });
});

// Formulario de edicao.
router.get('/cruzadas/:id/editar', requireProfessor, async (req, res) => {
  const cruzada = await obterCruzada(Number.parseInt(req.params.id, 10));
  if (!cruzada) {
    return res.status(404).render('erro', { titulo: 'Nao encontrada', mensagem: 'Cruzada inexistente.' });
  }
  if (cruzada.id_autor !== req.usuario.id_usuario) {
    return res.status(403).render('erro', {
      titulo: 'Acesso negado',
      mensagem: 'Apenas o professor autor pode editar esta cruzada (RN08).'
    });
  }
  const disciplinas = await listarDisciplinas();
  res.render('cruzadas/form', {
    modo: 'editar',
    idCruzada: cruzada.id_cruzada,
    disciplinas,
    cruzada,
    palavras: cruzada.palavras,
    erros: [],
    avisos: []
  });
});

// Salva a edicao -> cria uma NOVA versao (RN09).
router.post('/cruzadas/:id', requireProfessor, async (req, res) => {
  const idCruzada = Number.parseInt(req.params.id, 10);
  const dados = {
    titulo: req.body.titulo,
    descricao: req.body.descricao,
    dificuldade: req.body.dificuldade,
    status: req.body.status,
    id_disciplina: req.body.id_disciplina,
    palavras: extrairPalavras(req.body)
  };
  try {
    const { numeroVersao } = await editarCruzada({
      idCruzada,
      idAutor: req.usuario.id_usuario,
      dados
    });
    res.redirect(`/cruzadas/${idCruzada}?atualizada=${numeroVersao}`);
  } catch (err) {
    if (err instanceof ValidacaoError) {
      const disciplinas = await listarDisciplinas();
      return res.status(422).render('cruzadas/form', {
        modo: 'editar', idCruzada, disciplinas,
        cruzada: dados, palavras: dados.palavras, erros: err.erros, avisos: []
      });
    }
    if (err instanceof PermissaoError) {
      return res.status(403).render('erro', { titulo: 'Acesso negado', mensagem: err.message });
    }
    throw err;
  }
});

// Exclui a cruzada (RN03/RN08: apenas o autor).
router.post('/cruzadas/:id/excluir', requireProfessor, async (req, res) => {
  try {
    await excluirCruzada({
      idCruzada: Number.parseInt(req.params.id, 10),
      idAutor: req.usuario.id_usuario
    });
    res.redirect('/cruzadas');
  } catch (err) {
    if (err instanceof PermissaoError) {
      return res.status(403).render('erro', { titulo: 'Acesso negado', mensagem: err.message });
    }
    throw err;
  }
});

export default router;
