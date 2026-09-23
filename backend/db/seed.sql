-- ============================================================================
-- Dados iniciais (seed) - Cruzadinha Digital
--
-- Usuarios como se tivessem sido enviados pelo Ludica (id, usertag, email,
-- papel). O `id` do Ludica e gravado em `id_ludica`.
-- Os jogos de exemplo reproduzem o Painel Docente do prototipo (Prof. Carlos).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Usuarios: 2 professores e 3 alunos  (RN01: papel unico por usuario)
-- ---------------------------------------------------------------------------
INSERT INTO usuario (id_ludica, usertag, nome, email, papel) VALUES
    (1002, 'prof.carlos', 'Carlos Pereira',   'carlos.pereira@aluno.cefet-rj.br','professor'),
    (1001, 'prof.ana',    'Ana Souza',        'ana.souza@aluno.cefet-rj.br',    'professor'),
    (2001, 'aluno.bruno', 'Bruno Lima',       'bruno.lima@aluno.cefet-rj.br',   'aluno'),
    (2002, 'aluno.duda',  'Eduarda Nogueira', 'eduarda.nog@aluno.cefet-rj.br',  'aluno'),
    (2003, 'aluno.rafa',  'Rafael Martins',   'rafael.martins@aluno.cefet-rj.br','aluno')
ON CONFLICT (id_ludica) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Disciplinas de Ciencia da Computacao / Engenharia
-- ---------------------------------------------------------------------------
INSERT INTO disciplina (nome, codigo) VALUES
    ('Engenharia de Software',    'ES'),
    ('Sistemas Distribuidos',     'SD'),
    ('Banco de Dados',            'BD'),
    ('Estruturas de Dados',       'EDA'),
    ('Algoritmos',                'ALG'),
    ('Redes de Computadores',     'RC'),
    ('Sistemas Operacionais',     'SO')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Jogo 1: "Engenharia de Software - Conceitos"  (publicado, CSD-48291)
-- Grade valida:
--   HERANCA (horizontal, l1 c1)
--   CLASSE  (vertical,   l1 c6)  -> cruza em (l1,c6)=C
--   METODO  (horizontal, l6 c5)  -> cruza CLASSE em (l6,c6)=E
-- ---------------------------------------------------------------------------
WITH autor AS (SELECT id_usuario FROM usuario WHERE usertag = 'prof.carlos'),
     disc AS (SELECT id_disciplina FROM disciplina WHERE codigo = 'ES'),
     nova_cruzada AS (
        INSERT INTO palavra_cruzada
          (id_autor, id_disciplina, titulo, codigo_acesso, descricao, dificuldade, status)
        SELECT autor.id_usuario, disc.id_disciplina,
               'Engenharia de Software — Conceitos', 'CSD-48291',
               'Termos fundamentais de orientacao a objetos.', 'medio', 'publicado'
        FROM autor, disc
        RETURNING id_cruzada
     ),
     nova_versao AS (
        INSERT INTO versao_cruzada (id_cruzada, numero_versao)
        SELECT id_cruzada, 1 FROM nova_cruzada RETURNING id_versao
     )
INSERT INTO palavra (id_versao, resposta, dica, linha, coluna, direcao)
SELECT id_versao, resposta, dica, linha, coluna, direcao
FROM nova_versao,
     (VALUES
        ('HERANCA', 'Mecanismo de reuso onde uma classe deriva de outra.', 1, 1, 'horizontal'),
        ('CLASSE',  'Molde que define atributos e metodos de objetos.',    1, 6, 'vertical'),
        ('METODO',  'Comportamento (funcao) associado a um objeto.',       6, 5, 'horizontal')
     ) AS p(resposta, dica, linha, coluna, direcao);

-- ---------------------------------------------------------------------------
-- Jogo 2: "Padroes de Projeto GoF (Design Patterns)"  (rascunho, GOF-91024)
--   INTERFACE (horizontal, l3 c1)
--   ABSTRATA  (vertical,   l3 c7)  -> cruza em (l3,c7)=A
-- ---------------------------------------------------------------------------
WITH autor AS (SELECT id_usuario FROM usuario WHERE usertag = 'prof.carlos'),
     disc AS (SELECT id_disciplina FROM disciplina WHERE codigo = 'ES'),
     nova_cruzada AS (
        INSERT INTO palavra_cruzada
          (id_autor, id_disciplina, titulo, codigo_acesso, descricao, dificuldade, status)
        SELECT autor.id_usuario, disc.id_disciplina,
               'Padroes de Projeto GoF (Design Patterns)', 'GOF-91024',
               'Conceitos de projeto orientado a objetos.', 'dificil', 'rascunho'
        FROM autor, disc
        RETURNING id_cruzada
     ),
     nova_versao AS (
        INSERT INTO versao_cruzada (id_cruzada, numero_versao)
        SELECT id_cruzada, 1 FROM nova_cruzada RETURNING id_versao
     )
INSERT INTO palavra (id_versao, resposta, dica, linha, coluna, direcao)
SELECT id_versao, resposta, dica, linha, coluna, direcao
FROM nova_versao,
     (VALUES
        ('INTERFACE', 'Contrato que define metodos sem implementa-los.',    3, 1, 'horizontal'),
        ('ABSTRATA',  'Classe que nao pode ser instanciada diretamente.',   3, 7, 'vertical')
     ) AS p(resposta, dica, linha, coluna, direcao);

-- ---------------------------------------------------------------------------
-- Sessoes de jogo de exemplo no Jogo 1 (para o Painel nao ficar zerado).
-- RN10/RN12: multiplas sessoes com tempo, acertos e pontuacao.
-- ---------------------------------------------------------------------------
INSERT INTO sessao_jogo (id_versao, id_aluno, fim, tempo, tentativas, acertos, erros, pontuacao)
SELECT v.id_versao, u.id_usuario,
       CURRENT_TIMESTAMP, s.tempo, s.tent, s.acertos, s.erros, s.pont
FROM versao_cruzada v
JOIN palavra_cruzada pc ON pc.id_cruzada = v.id_cruzada AND pc.codigo_acesso = 'CSD-48291'
JOIN (VALUES
        ('aluno.bruno', 272, 4, 3, 1, 920.00),
        ('aluno.duda',  230, 3, 3, 0, 980.00),
        ('aluno.rafa',  312, 5, 2, 3, 870.00)
     ) AS s(usertag, tempo, tent, acertos, erros, pont) ON TRUE
JOIN usuario u ON u.usertag = s.usertag
WHERE v.numero_versao = 1;
