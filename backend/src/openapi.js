// ============================================================================
// Especificacao OpenAPI da API, servida pelo Swagger UI em /api/docs.
//
// A autenticacao e por cookie de sessao: chame POST /auth/entrar (atalho de
// desenvolvimento) ou entre pelo Ludica (POST /auth/ludica) primeiro e o
// navegador passa a mandar o cookie nas demais.
// Ao criar/alterar rotas, atualize este arquivo.
// ============================================================================
import * as regras from './regras.js';

const json = (schema, example) => ({
  'application/json': example === undefined ? { schema } : { schema, example }
});
const corpo = (schema, example) => ({ required: true, content: json(schema, example) });
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const ok = (description = 'OK', schema = { type: 'object' }) => ({ description, content: json(schema) });
const erro = (description) => ({ description, content: json(ref('Erro')) });

const pathId = (description) => ({
  name: 'id', in: 'path', required: true, description, schema: { type: 'integer' }
});

// Respostas de erro que se repetem nas rotas protegidas.
const protegida = {
  401: erro('Sem login (chame POST /auth/entrar antes).'),
  403: erro('Papel sem permissão para esta rota.')
};
const comValidacao = { 422: erro('Dados inválidos (ver `erros`).') };

const disciplinaEntrada = {
  type: 'object',
  required: ['nome', 'codigo'],
  properties: {
    nome: { type: 'string', maxLength: 100 },
    codigo: { type: 'string', pattern: '^[A-Z0-9]{1,20}$', description: 'Convertido para maiúsculas.' },
    ativa: { type: 'boolean', description: 'Só no PUT. Omitido = mantém.' }
  }
};

const cruzadaEntrada = {
  type: 'object',
  required: ['titulo', 'id_disciplina', 'dificuldade', 'palavras'],
  properties: {
    titulo: { type: 'string', maxLength: 150 },
    descricao: { type: 'string', nullable: true },
    id_disciplina: { type: 'integer', description: 'Disciplina ativa (RN04).' },
    dificuldade: { type: 'string', enum: regras.DIFICULDADES },
    status: { type: 'string', enum: regras.STATUS_CRUZADA, default: 'rascunho' },
    palavras: {
      type: 'array',
      minItems: regras.MIN_PALAVRAS,
      maxItems: regras.MAX_PALAVRAS,
      description: 'A grade é gerada no servidor (RN06/RN14).',
      items: {
        type: 'object',
        required: ['resposta', 'dica'],
        properties: {
          resposta: { type: 'string', minLength: regras.MIN_LETRAS, maxLength: regras.MAX_LETRAS },
          dica: { type: 'string', maxLength: regras.MAX_DICA }
        }
      }
    }
  }
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Cruzadinha Digital - API',
    version: '2.0.0',
    description:
      'API REST da Cruzadinha Digital (CEFET-RJ).\n\n' +
      '**Como testar:** a autenticação é por cookie de sessão. Abra `POST /auth/entrar`, ' +
      'clique em *Try it out* e envie o `id_usuario` de alguém de `GET /auth/usuarios`. ' +
      'A partir daí as rotas daquele papel funcionam nesta mesma página.'
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Sistema' },
    { name: 'Autenticação', description: 'Login simulado enquanto o Lúdica não está integrado.' },
    { name: 'Disciplinas', description: 'Manter Disciplina (administrador).' },
    { name: 'Solicitações', description: 'Pedidos de disciplina nova (RN16).' },
    { name: 'Professor', description: 'Cruzadas do professor (RN02/RN03/RN08).' },
    { name: 'Aluno', description: 'Busca de jogos e partida (RN10/RN11/RN12/RN20).' }
  ],
  components: {
    securitySchemes: {
      sessao: { type: 'apiKey', in: 'cookie', name: 'cruzadinha.sid' }
    },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          erro: { type: 'string' },
          erros: { type: 'array', items: { type: 'string' } }
        }
      },
      Usuario: {
        type: 'object',
        properties: {
          id_usuario: { type: 'integer' },
          id_ludica: { type: 'integer', nullable: true },
          usertag: { type: 'string', description: 'gamertag no Lúdica' },
          nome: { type: 'string' },
          email: { type: 'string' },
          papel: { type: 'string', enum: regras.PAPEIS }
        }
      },
      Disciplina: {
        type: 'object',
        properties: {
          id_disciplina: { type: 'integer' },
          nome: { type: 'string' },
          codigo: { type: 'string' },
          ativa: { type: 'boolean' },
          total_cruzadas: { type: 'integer' }
        }
      }
    }
  },
  paths: {
    // --- Sistema ------------------------------------------------------------
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Verifica a conexão com PostgreSQL e MongoDB',
        responses: {
          200: ok('Bancos respondendo.'),
          503: ok('Algum banco indisponível.')
        }
      }
    },
    '/status': {
      get: {
        tags: ['Sistema'],
        summary: 'Status para o Lúdica (chamado antes de cada partida)',
        description: 'O Lúdica espera 200 em até 3 s; senão avisa o aluno que o jogo está fora do ar.',
        responses: {
          200: ok('Jogo no ar.', { type: 'object', properties: { status: { type: 'string', example: 'online' }, jogo: { type: 'string', example: 'CRUZADINHA' } } }),
          503: ok('Algum banco indisponível.')
        }
      }
    },
    '/regras': {
      get: {
        tags: ['Sistema'],
        summary: 'Limites de negócio (palavras, letras, dicas)',
        responses: { 200: ok() }
      }
    },

    // --- Autenticacao -------------------------------------------------------
    '/auth/usuarios': {
      get: {
        tags: ['Autenticação'],
        summary: 'Lista os usuários (tela "entrar como"; só com LOGIN_DEV)',
        responses: { 200: ok('OK', { type: 'array', items: ref('Usuario') }) }
      }
    },
    '/auth/eu': {
      get: {
        tags: ['Autenticação'],
        summary: 'Usuário da sessão atual (null se não logado)',
        responses: { 200: ok('OK', ref('Usuario')) }
      }
    },
    '/auth/entrar': {
      post: {
        tags: ['Autenticação'],
        summary: 'Entra como um usuário existente (atalho de desenvolvimento; só com LOGIN_DEV)',
        requestBody: corpo(
          { type: 'object', required: ['id_usuario'], properties: { id_usuario: { type: 'integer' } } },
          { id_usuario: 1 }
        ),
        responses: { 200: ok('Logado; cookie de sessão criado.', ref('Usuario')), 404: erro('Usuário não encontrado.') }
      }
    },
    '/auth/ludica': {
      post: {
        tags: ['Autenticação'],
        summary: 'Entrada vinda do Lúdica (formulário; redireciona)',
        description:
          'O navegador do jogador chega aqui por um POST de formulário feito pelo Lúdica. ' +
          'Confere `hash` = hex(sha256("LUD1C@-NOMEJOGO-JOGAR-gamertag-DDMMAAAA")) com o nosso NOMEJOGO ' +
          '(LUDICA_NOME_JOGO, padrão CRUZADINHA) e a data de hoje em Brasília; cria/atualiza o usuário pela ' +
          'gamertag, guarda o `url_retorno` e redireciona (303) para `/` com a sessão criada. Se algo falhar, ' +
          'redireciona para `/login?erro=token|perfil|email|dados`. Ver docs/integracao-ludica.md.',
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['tipo_usuario', 'email', 'gamertag', 'hash', 'url_retorno'],
                properties: {
                  tipo_usuario: { type: 'string', enum: ['aluno', 'professor', 'administrador'] },
                  email: { type: 'string' },
                  gamertag: { type: 'string' },
                  hash: { type: 'string', description: 'SHA-256 da seed JOGAR (64 hex)' },
                  jogo: { type: 'string', description: 'informativo; o hash usa o nosso NOMEJOGO' },
                  data: { type: 'string', description: 'DDMMAAAA; informativo, o hash usa a nossa data' },
                  url_retorno: { type: 'string', description: 'para onde enviar o resultado da partida' }
                }
              }
            }
          }
        },
        responses: { 303: { description: 'Redireciona para `/` (logado) ou `/login?erro=...`.' } }
      }
    },
    '/auth/modo': {
      get: {
        tags: ['Autenticação'],
        summary: 'Se os atalhos de desenvolvimento estão ligados (LOGIN_DEV)',
        responses: { 200: ok('OK', {
          type: 'object',
          properties: {
            login_dev: { type: 'boolean' },
            url_ludica: { type: 'string', nullable: true },
            url_retorno_dev: { type: 'string', description: 'só em desenvolvimento' }
          }
        }) }
      }
    },
    '/auth/dev/entrada-ludica': {
      post: {
        tags: ['Autenticação'],
        summary: 'Gera os campos que o Lúdica mandaria na entrada (só com LOGIN_DEV)',
        description: 'O front monta um formulário com `campos` e faz POST em `acao`.',
        requestBody: corpo(
          {
            type: 'object',
            required: ['tipo_usuario', 'email', 'gamertag'],
            properties: {
              tipo_usuario: { type: 'string' }, email: { type: 'string' }, gamertag: { type: 'string' },
              url_retorno: { type: 'string' }
            }
          },
          { tipo_usuario: 'aluno', email: 'aluno.novo@aluno.cefet-rj.br', gamertag: 'aluno.novo' }
        ),
        responses: {
          200: ok('OK', { type: 'object', properties: { acao: { type: 'string' }, jogo: { type: 'string' }, campos: { type: 'object' } } }),
          404: erro('LOGIN_DEV desligado.')
        }
      }
    },
    '/auth/sair': {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerra a sessão',
        description: 'Devolve a página inicial do Lúdica (LUDICA_URL_SITE), para onde o front manda o usuário.',
        responses: {
          200: ok('Sessão encerrada.', { type: 'object', properties: { url_ludica: { type: 'string', nullable: true } } })
        }
      }
    },

    // --- Disciplinas --------------------------------------------------------
    '/disciplinas': {
      get: {
        tags: ['Disciplinas'],
        summary: 'Lista disciplinas ativas (admin com todas=1 vê todas)',
        security: [{ sessao: [] }],
        parameters: [
          { name: 'todas', in: 'query', description: 'Só para administrador.', schema: { type: 'string', enum: ['1'] } }
        ],
        responses: { 200: ok('OK', { type: 'array', items: ref('Disciplina') }), ...protegida }
      },
      post: {
        tags: ['Disciplinas'],
        summary: 'Cria disciplina (administrador)',
        security: [{ sessao: [] }],
        requestBody: corpo(disciplinaEntrada, { nome: 'Banco de Dados', codigo: 'BD' }),
        responses: {
          201: ok('Criada.', ref('Disciplina')),
          ...protegida,
          409: erro('Código já existe.'),
          ...comValidacao
        }
      }
    },
    '/disciplinas/{id}': {
      parameters: [pathId('id_disciplina')],
      put: {
        tags: ['Disciplinas'],
        summary: 'Edita disciplina (administrador)',
        security: [{ sessao: [] }],
        requestBody: corpo(disciplinaEntrada),
        responses: {
          200: ok('OK', ref('Disciplina')),
          ...protegida,
          404: erro('Não encontrada.'),
          409: erro('Código já existe.'),
          ...comValidacao
        }
      },
      delete: {
        tags: ['Disciplinas'],
        summary: 'Exclui, ou só desativa se tiver cruzadas (RN15)',
        security: [{ sessao: [] }],
        responses: {
          200: ok('`resultado` = "excluida" ou "desativada".'),
          ...protegida,
          404: erro('Não encontrada.')
        }
      }
    },

    // --- Solicitacoes -------------------------------------------------------
    '/solicitacoes': {
      get: {
        tags: ['Solicitações'],
        summary: 'Professor vê as suas; administrador vê todas',
        security: [{ sessao: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pendente', 'aprovada', 'recusada'] } }
        ],
        responses: { 200: ok('OK', { type: 'array', items: { type: 'object' } }), ...protegida }
      },
      post: {
        tags: ['Solicitações'],
        summary: 'Professor pede uma disciplina nova',
        security: [{ sessao: [] }],
        requestBody: corpo(
          {
            type: 'object',
            required: ['nome'],
            properties: {
              nome: { type: 'string', maxLength: 100 },
              codigo_sugerido: { type: 'string', pattern: '^[A-Z0-9]{1,20}$' },
              justificativa: { type: 'string' }
            }
          },
          { nome: 'Compiladores', codigo_sugerido: 'COMP', justificativa: 'Disciplina optativa nova.' }
        ),
        responses: { 201: ok('Criada (devolve id_solicitacao).'), ...protegida, ...comValidacao }
      }
    },
    '/solicitacoes/{id}/responder': {
      parameters: [pathId('id_solicitacao')],
      post: {
        tags: ['Solicitações'],
        summary: 'Administrador aprova (cria a disciplina) ou recusa',
        security: [{ sessao: [] }],
        requestBody: corpo(
          {
            type: 'object',
            required: ['aprovar'],
            properties: {
              aprovar: { type: 'boolean' },
              nome: { type: 'string', description: 'Ajusta o nome ao aprovar.' },
              codigo: { type: 'string', description: 'Ajusta o código ao aprovar.' },
              resposta: { type: 'string', description: 'Mensagem para o professor.' }
            }
          },
          { aprovar: true, resposta: 'Aprovada.' }
        ),
        responses: {
          200: ok(),
          ...protegida,
          404: erro('Não encontrada.'),
          409: erro('Já respondida ou código repetido.'),
          ...comValidacao
        }
      }
    },

    // --- Professor ----------------------------------------------------------
    '/professor/cruzadas': {
      get: {
        tags: ['Professor'],
        summary: 'Painel: cruzadas do professor + estatísticas',
        security: [{ sessao: [] }],
        responses: { 200: ok('`{ cruzadas, estatisticas }`'), ...protegida }
      },
      post: {
        tags: ['Professor'],
        summary: 'Cria cruzada (versão 1)',
        security: [{ sessao: [] }],
        requestBody: corpo(cruzadaEntrada, {
          titulo: 'Estruturas de Dados',
          id_disciplina: 1,
          dificuldade: 'facil',
          status: 'publicado',
          palavras: [
            { resposta: 'PILHA', dica: 'Estrutura LIFO' },
            { resposta: 'FILA', dica: 'Estrutura FIFO' },
            { resposta: 'ARVORE', dica: 'Estrutura hierárquica com raiz' },
            { resposta: 'GRAFO', dica: 'Vértices ligados por arestas' },
            { resposta: 'LISTA', dica: 'Sequência de nós encadeados' }
          ]
        }),
        responses: { 201: ok('Criada (idCruzada, numeroVersao, idVersao).'), ...protegida, ...comValidacao }
      }
    },
    '/professor/cruzadas/{id}': {
      parameters: [pathId('id_cruzada')],
      get: {
        tags: ['Professor'],
        summary: 'Detalhe com gabarito, ranking e partidas (só o autor)',
        security: [{ sessao: [] }],
        responses: { 200: ok(), ...protegida, 404: erro('Não encontrada.') }
      },
      put: {
        tags: ['Professor'],
        summary: 'Edita; se as palavras mudarem, cria nova versão (RN09)',
        security: [{ sessao: [] }],
        requestBody: corpo(cruzadaEntrada),
        responses: { 200: ok('`novaVersao` indica se gerou versão.'), ...protegida, 404: erro('Não encontrada.'), ...comValidacao }
      },
      delete: {
        tags: ['Professor'],
        summary: 'Exclui (recusa se já houver partidas)',
        security: [{ sessao: [] }],
        responses: {
          204: { description: 'Excluída.' },
          ...protegida,
          404: erro('Não encontrada.'),
          409: erro('Já tem partidas; arquive em vez de excluir.')
        }
      }
    },

    // --- Aluno --------------------------------------------------------------
    '/jogos': {
      get: {
        tags: ['Aluno'],
        summary: 'Busca cruzadas publicadas',
        security: [{ sessao: [] }],
        parameters: [
          { name: 'texto', in: 'query', schema: { type: 'string' } },
          { name: 'disciplina', in: 'query', description: 'id_disciplina', schema: { type: 'integer' } },
          { name: 'dificuldade', in: 'query', schema: { type: 'string', enum: regras.DIFICULDADES } },
          { name: 'codigo', in: 'query', description: 'Código de acesso', schema: { type: 'string' } }
        ],
        responses: { 200: ok('OK', { type: 'array', items: { type: 'object' } }), ...protegida }
      }
    },
    '/jogos/{id}': {
      parameters: [pathId('id_cruzada')],
      get: {
        tags: ['Aluno'],
        summary: 'Detalhe do jogo (sem respostas)',
        security: [{ sessao: [] }],
        responses: { 200: ok(), ...protegida, 404: erro('Não encontrado.') }
      }
    },
    '/jogos/{id}/sessoes': {
      parameters: [pathId('id_cruzada')],
      post: {
        tags: ['Aluno'],
        summary: 'Inicia (ou retoma) uma partida na versão atual',
        security: [{ sessao: [] }],
        responses: { 201: ok(), ...protegida, 404: erro('Jogo não publicado.') }
      }
    },
    '/sessoes/{id}': {
      parameters: [pathId('id_sessao')],
      get: {
        tags: ['Aluno'],
        summary: 'Estado da partida (grade, últimas respostas, resultado)',
        security: [{ sessao: [] }],
        responses: { 200: ok(), ...protegida, 404: erro('Não encontrada.') }
      }
    },
    '/sessoes/{id}/conferir': {
      parameters: [pathId('id_sessao')],
      post: {
        tags: ['Aluno'],
        summary: 'Confere a grade preenchida',
        security: [{ sessao: [] }],
        requestBody: corpo(
          {
            type: 'object',
            required: ['respostas'],
            properties: {
              respostas: {
                type: 'object',
                description: '{ [indice da palavra]: "TEXTO" }',
                additionalProperties: { type: 'string' }
              }
            }
          },
          { respostas: { 0: 'PILHA', 1: 'FILA' } }
        ),
        responses: { 200: ok(), ...protegida, 409: erro('Partida já encerrada.'), ...comValidacao }
      }
    },
    '/sessoes/{id}/dica': {
      parameters: [pathId('id_sessao')],
      post: {
        tags: ['Aluno'],
        summary: `Revela uma letra (RN20, até ${regras.DICAS.maxPorPartida} por partida)`,
        security: [{ sessao: [] }],
        requestBody: corpo(
          {
            type: 'object',
            required: ['indice'],
            properties: {
              indice: { type: 'integer', description: 'Índice da palavra.' },
              atual: { type: 'string', description: 'O que está na tela para a palavra (" " = casa vazia).' }
            }
          },
          { indice: 0, atual: 'P    ' }
        ),
        responses: {
          200: ok('Casa revelada (linha, coluna, letra) e dicas_restantes.'),
          ...protegida,
          409: erro('Sem dicas, partida encerrada ou palavra já revelada.'),
          ...comValidacao
        }
      }
    },
    '/sessoes/{id}/encerrar': {
      parameters: [pathId('id_sessao')],
      post: {
        tags: ['Aluno'],
        summary: 'Desiste/encerra e pontua com a última conferência',
        security: [{ sessao: [] }],
        responses: { 200: ok(), ...protegida, 409: erro('Partida já encerrada.') }
      }
    }
  }
};
