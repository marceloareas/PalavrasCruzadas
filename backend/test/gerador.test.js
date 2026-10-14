import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarResposta,
  validarPalavras,
  gerarGrade,
  montarMatriz
} from '../src/services/gerador.js';

const p = (resposta) => ({ resposta, dica: `dica de ${resposta}` });

const ES = ['HERANCA', 'CLASSE', 'METODO', 'OBJETO', 'INTERFACE', 'ATRIBUTO', 'POLIMORFISMO'].map(p);

// Confere as propriedades que toda grade gerada precisa respeitar.
function conferirGrade(r) {
  const celulas = new Map();
  for (const w of r.palavras) {
    assert.ok(w.linha >= 1 && w.coluna >= 1, `${w.resposta} fora da grade`);
    for (let i = 0; i < w.resposta.length; i++) {
      const l = w.direcao === 'vertical' ? w.linha + i : w.linha;
      const c = w.direcao === 'horizontal' ? w.coluna + i : w.coluna;
      assert.ok(l <= r.linhas && c <= r.colunas, `${w.resposta} passa do limite`);
      const k = `${l},${c}`;
      const atual = celulas.get(k);
      if (atual) {
        assert.equal(atual.letra, w.resposta[i], `conflito em ${k}`);
        assert.notEqual(atual.direcao, w.direcao, `sobreposicao em ${k}`);
      }
      celulas.set(k, { letra: w.resposta[i], direcao: w.direcao });
    }
  }
  // Toda sequencia continua de letras (em linha ou coluna) tem que ser uma
  // das palavras cadastradas - nada de "palavras acidentais" encostadas.
  const respostas = new Set(r.palavras.map((w) => `${w.direcao}:${w.linha},${w.coluna}:${w.resposta}`));
  const m = montarMatriz(r);
  const sequencias = (dir) => {
    const achadas = [];
    const L = dir === 'horizontal' ? r.linhas : r.colunas;
    const C = dir === 'horizontal' ? r.colunas : r.linhas;
    for (let a = 0; a < L; a++) {
      let atual = '';
      let inicio = 0;
      for (let b = 0; b <= C; b++) {
        const letra = b < C ? (dir === 'horizontal' ? m[a][b] : m[b][a]) : null;
        if (letra) {
          if (!atual) inicio = b;
          atual += letra;
        } else {
          if (atual.length > 1) {
            const [l, c] = dir === 'horizontal' ? [a + 1, inicio + 1] : [inicio + 1, a + 1];
            achadas.push(`${dir}:${l},${c}:${atual}`);
          }
          atual = '';
        }
      }
    }
    return achadas;
  };
  for (const s of [...sequencias('horizontal'), ...sequencias('vertical')]) {
    assert.ok(respostas.has(s), `sequencia acidental na grade: ${s}`);
  }
}

test('normaliza acentos, caixa e espacos', () => {
  assert.equal(normalizarResposta('função'), 'FUNCAO');
  assert.equal(normalizarResposta(' chave primária '), 'CHAVEPRIMARIA');
});

test('exige entre 5 e 15 palavras (RN13)', () => {
  assert.ok(validarPalavras(ES.slice(0, 4)).some((e) => e.includes('entre 5 e 15')));
  assert.deepEqual(validarPalavras(ES.slice(0, 5)), []);
  const dezesseis = Array.from({ length: 16 }, (_, i) => p('PALAVRA' + String.fromCharCode(65 + i)));
  assert.ok(validarPalavras(dezesseis).some((e) => e.includes('entre 5 e 15')));
});

test('recusa dica vazia, resposta curta e repetida', () => {
  const erros = validarPalavras([
    p('CLASSE'),
    { resposta: 'OBJETO', dica: '  ' },
    p('A'),
    p('classe'),
    p('METODO')
  ]);
  assert.ok(erros.some((e) => e.includes('dica')));
  assert.ok(erros.some((e) => e.includes('entre 2 e 20 letras')));
  assert.ok(erros.some((e) => e.includes('repete')));
});

test('gera grade valida e conectada a partir so de respostas (RN14)', () => {
  const r = gerarGrade(ES);
  assert.equal(r.ok, true, `nao encaixou: ${r.naoEncaixadas}`);
  assert.equal(r.palavras.length, ES.length);
  conferirGrade(r);
});

test('mesma entrada gera sempre a mesma grade', () => {
  assert.deepEqual(gerarGrade(ES), gerarGrade(ES));
});

test('mantem o indice original e numera as dicas', () => {
  const r = gerarGrade(ES);
  assert.deepEqual(r.palavras.map((w) => w.indice), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(r.palavras.every((w) => Number.isInteger(w.numero) && w.numero >= 1));
});

test('encaixa 15 palavras de Banco de Dados', () => {
  const bd = [
    'TABELA', 'CHAVE', 'INDICE', 'CONSULTA', 'TRANSACAO', 'COMMIT', 'ROLLBACK',
    'NORMALIZACAO', 'ENTIDADE', 'ATRIBUTO', 'RELACIONAMENTO', 'VISAO',
    'GATILHO', 'CURSOR', 'ESQUEMA'
  ].map(p);
  const r = gerarGrade(bd);
  assert.equal(r.ok, true, `nao encaixou: ${r.naoEncaixadas}`);
  conferirGrade(r);
});

test('aponta palavra sem letra em comum (RN06)', () => {
  const r = gerarGrade([...ES.slice(0, 4), p('XYZ')]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.naoEncaixadas, ['XYZ']);
});

test('matriz do aluno nao revela letras (RN11)', () => {
  const r = gerarGrade(ES);
  const m = montarMatriz(r, { ocultarLetras: true });
  assert.ok(m.flat().every((c) => c === null || c === ''));
  assert.ok(m.flat().some((c) => c === ''));
});
