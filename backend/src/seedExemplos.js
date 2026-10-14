// ============================================================================
// Cruzadas de exemplo, criadas na primeira subida da API (se o banco nao tiver
// nenhuma). Passam pelo mesmo caminho do professor: validacao, gerador de
// grade e gravacao no PostgreSQL + MongoDB.
// ============================================================================
import { pool } from './db/postgres.js';
import { criarCruzada, obterConteudo } from './services/cruzadaService.js';
import { calcularPontuacao } from './services/pontuacao.js';

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

// Partidas de exemplo no 1o jogo: em que tentativa cada palavra foi
// acertada (null = terminou errada) e o tempo em segundos. Pontuacao e
// historico de respostas saem da mesma regra do jogo.
const SESSOES = [
  ['aluno.bruno', 272, [1, 1, 1, 2, 2, 3, null]],
  ['aluno.duda', 230, [1, 1, 1, 1, 1, 1, 2]],
  ['aluno.rafa', 312, [1, 1, 2, 2, 3, null, null]]
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
    const { palavras } = await obterConteudo(primeira.idVersao);
    for (const [usertag, tempo, acertos] of SESSOES) {
      if (!idUsuario[usertag]) continue;
      const tentativas = Math.max(...acertos.map((a) => a ?? 1));
      const { pontuacao, detalhe } = calcularPontuacao({ acertos, dificuldade: EXEMPLOS[0].dificuldade, tempo });
      const { rows: [s] } = await pool.query(
        `INSERT INTO sessao_jogo (id_versao, id_aluno, inicio, fim, tempo, tentativas, acertos, pontuacao)
         VALUES ($1, $2, CURRENT_TIMESTAMP - make_interval(secs => $3), CURRENT_TIMESTAMP, $3, $4, $5, $6)
         RETURNING id_sessao`,
        [primeira.idVersao, idUsuario[usertag], tempo, tentativas, detalhe.certas, pontuacao]
      );
      let erros = 0;
      for (let n = 1; n <= tentativas; n++) {
        for (const p of palavras) {
          const a = acertos[p.indice - 1];
          const correta = a !== null && n >= a;
          if (!correta) erros++;
          await pool.query(
            `INSERT INTO resposta_sessao (id_sessao, indice_palavra, resposta_informada, correta, numero_tentativa)
             VALUES ($1, $2, $3, $4, $5)`,
            [s.id_sessao, p.indice, correta ? p.resposta : '', correta, n]
          );
        }
      }
      await pool.query('UPDATE sessao_jogo SET erros = $1 WHERE id_sessao = $2', [erros, s.id_sessao]);
    }
  }
  console.log(`Seed: ${EXEMPLOS.length} cruzadas de exemplo criadas.`);
}
