// ============================================================================
// Cruzadas de exemplo, criadas na primeira subida da API (se o banco nao tiver
// nenhuma). Passam pelo mesmo caminho do professor: validacao, gerador de
// grade e gravacao no PostgreSQL + MongoDB.
// ============================================================================
import { pool } from './db/postgres.js';
import { criarCruzada } from './services/cruzadaService.js';

const EXEMPLOS = [
  {
    autor: 'prof.carlos',
    disciplina: 'ES',
    titulo: 'Engenharia de Software — Conceitos de OO',
    descricao: 'Termos fundamentais de orientação a objetos.',
    dificuldade: 'medio',
    status: 'publicado',
    palavras: [
      ['HERANÇA', 'Mecanismo de reuso em que uma classe deriva de outra.'],
      ['CLASSE', 'Molde que define atributos e métodos de objetos.'],
      ['MÉTODO', 'Comportamento (função) associado a um objeto.'],
      ['OBJETO', 'Instância concreta de uma classe.'],
      ['INTERFACE', 'Contrato que declara métodos sem implementá-los.'],
      ['ATRIBUTO', 'Característica (dado) de um objeto.'],
      ['POLIMORFISMO', 'Capacidade de um mesmo método ter comportamentos diferentes.']
    ]
  },
  {
    autor: 'prof.carlos',
    disciplina: 'ES',
    titulo: 'Padrões de Projeto (GoF)',
    descricao: 'Padrões criacionais, estruturais e comportamentais.',
    dificuldade: 'dificil',
    status: 'rascunho',
    palavras: [
      ['SINGLETON', 'Garante uma única instância de uma classe.'],
      ['ADAPTER', 'Converte a interface de uma classe em outra esperada pelo cliente.'],
      ['OBSERVER', 'Notifica dependentes quando um objeto muda de estado.'],
      ['FACTORY', 'Cria objetos sem expor a lógica de instanciação.'],
      ['DECORATOR', 'Adiciona responsabilidades a um objeto dinamicamente.'],
      ['STRATEGY', 'Encapsula algoritmos intercambiáveis.']
    ]
  },
  {
    autor: 'prof.ana',
    disciplina: 'BD',
    titulo: 'Banco de Dados — Fundamentos',
    descricao: 'Modelo relacional e SQL básico.',
    dificuldade: 'facil',
    status: 'publicado',
    palavras: [
      ['TABELA', 'Estrutura formada por linhas e colunas.'],
      ['CHAVE', 'Atributo que identifica unicamente uma tupla.'],
      ['ÍNDICE', 'Estrutura que acelera buscas em uma tabela.'],
      ['CONSULTA', 'Comando para recuperar dados (ex.: SELECT).'],
      ['TRANSAÇÃO', 'Unidade de trabalho atômica no banco.'],
      ['COMMIT', 'Confirma as alterações de uma transação.'],
      ['ROLLBACK', 'Desfaz as alterações de uma transação.'],
      ['ENTIDADE', 'Objeto do mundo real representado no modelo ER.']
    ]
  },
  {
    autor: 'prof.ana',
    disciplina: 'SO',
    titulo: 'Sistemas Operacionais — Processos',
    descricao: 'Escalonamento, concorrência e memória.',
    dificuldade: 'medio',
    status: 'publicado',
    palavras: [
      ['PROCESSO', 'Programa em execução.'],
      ['THREAD', 'Fluxo de execução dentro de um processo.'],
      ['SEMÁFORO', 'Primitiva de sincronização com contador.'],
      ['DEADLOCK', 'Espera circular em que nenhum processo avança.'],
      ['ESCALONADOR', 'Componente que decide qual processo usa a CPU.'],
      ['KERNEL', 'Núcleo do sistema operacional.']
    ]
  }
];

const SESSOES = [
  ['aluno.bruno', 272, 4, 6, 1, 920],
  ['aluno.duda', 230, 3, 7, 0, 980],
  ['aluno.rafa', 312, 5, 5, 2, 870]
];

export async function criarExemplosSeVazio() {
  const { rows: [{ total }] } = await pool.query('SELECT COUNT(*)::int AS total FROM palavra_cruzada');
  if (total > 0) return;

  const { rows: usuarios } = await pool.query('SELECT id_usuario, usertag FROM usuario');
  const { rows: disciplinas } = await pool.query('SELECT id_disciplina, codigo FROM disciplina');
  const idUsuario = Object.fromEntries(usuarios.map((u) => [u.usertag, u.id_usuario]));
  const idDisciplina = Object.fromEntries(disciplinas.map((d) => [d.codigo, d.id_disciplina]));

  let primeira = null;
  for (const ex of EXEMPLOS) {
    if (!idUsuario[ex.autor] || !idDisciplina[ex.disciplina]) continue;
    const r = await criarCruzada({
      idAutor: idUsuario[ex.autor],
      dados: {
        titulo: ex.titulo,
        descricao: ex.descricao,
        dificuldade: ex.dificuldade,
        status: ex.status,
        id_disciplina: idDisciplina[ex.disciplina],
        palavras: ex.palavras.map(([resposta, dica]) => ({ resposta, dica }))
      }
    });
    primeira ??= r;
  }

  // Algumas partidas no 1o jogo, para o painel do professor nao ficar zerado.
  if (primeira) {
    for (const [usertag, tempo, tentativas, acertos, erros, pontuacao] of SESSOES) {
      if (!idUsuario[usertag]) continue;
      await pool.query(
        `INSERT INTO sessao_jogo (id_versao, id_aluno, fim, tempo, tentativas, acertos, erros, pontuacao)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)`,
        [primeira.idVersao, idUsuario[usertag], tempo, tentativas, acertos, erros, pontuacao]
      );
    }
  }
  console.log(`Seed: ${EXEMPLOS.length} cruzadas de exemplo criadas.`);
}
