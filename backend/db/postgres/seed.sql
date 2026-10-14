-- ============================================================================
-- Dados iniciais (seed) - Cruzadinha Digital
--
-- Usuarios como se tivessem sido enviados pelo Ludica (id, usertag, email,
-- papel). O `id` do Ludica e gravado em `id_ludica`.
--
-- As cruzadas de exemplo NAO estao aqui: elas tem conteudo no MongoDB e sao
-- criadas pela API na primeira subida (src/seedExemplos.js), usando o mesmo
-- gerador de grade que o professor usa.
-- ============================================================================

-- RN01: papel unico por usuario.
INSERT INTO usuario (id_ludica, usertag, nome, email, papel) VALUES
    (1002, 'prof.carlos', 'Carlos Pereira',   'carlos.pereira@cefet-rj.br',       'professor'),
    (1001, 'prof.ana',    'Ana Souza',        'ana.souza@cefet-rj.br',            'professor'),
    (2001, 'aluno.bruno', 'Bruno Lima',       'bruno.lima@aluno.cefet-rj.br',     'aluno'),
    (2002, 'aluno.duda',  'Eduarda Nogueira', 'eduarda.nog@aluno.cefet-rj.br',    'aluno'),
    (2003, 'aluno.rafa',  'Rafael Martins',   'rafael.martins@aluno.cefet-rj.br', 'aluno'),
    (9001, 'admin.dcc',   'Secretaria DCC',   'secretaria.dcc@cefet-rj.br',       'administrador')
ON CONFLICT (id_ludica) DO NOTHING;

INSERT INTO disciplina (nome, codigo) VALUES
    ('Engenharia de Software',  'ES'),
    ('Sistemas Distribuídos',   'SD'),
    ('Banco de Dados',          'BD'),
    ('Estruturas de Dados',     'EDA'),
    ('Algoritmos',              'ALG'),
    ('Redes de Computadores',   'RC'),
    ('Sistemas Operacionais',   'SO')
ON CONFLICT (codigo) DO NOTHING;

-- Uma solicitacao pendente para o administrador ver (RN16).
INSERT INTO solicitacao_disciplina (id_professor, nome, codigo_sugerido, justificativa)
SELECT id_usuario, 'Compiladores', 'COMP',
       'Quero montar cruzadas sobre analise lexica e sintatica.'
  FROM usuario WHERE usertag = 'prof.ana';
