import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarGrade, normalizarResposta, montarMatriz } from '../src/services/gridValidator.js';

test('normaliza acentos e caixa', () => {
  assert.equal(normalizarResposta('função'), 'FUNCAO');
  assert.equal(normalizarResposta(' chave '), 'CHAVE');
});

test('grade valida com intersecoes corretas (seed)', () => {
  const palavras = [
    { resposta: 'CHAVE',  dica: 'x', linha: 1, coluna: 2, direcao: 'vertical' },
    { resposta: 'TABELA', dica: 'y', linha: 3, coluna: 1, direcao: 'horizontal' },
    { resposta: 'VALOR',  dica: 'z', linha: 4, coluna: 2, direcao: 'horizontal' }
  ];
  const r = validarGrade(palavras);
  assert.equal(r.valido, true, JSON.stringify(r.erros));
  assert.equal(r.avisos.length, 0);
});

test('detecta conflito de intersecao (RN06)', () => {
  const palavras = [
    { resposta: 'CASA', dica: 'a', linha: 1, coluna: 1, direcao: 'horizontal' },
    // 'SOL' vertical cruzando col1 -> em (1,1) teria 'S' vs 'C' de CASA
    { resposta: 'SOL',  dica: 'b', linha: 1, coluna: 1, direcao: 'vertical' }
  ];
  const r = validarGrade(palavras);
  assert.equal(r.valido, false);
  assert.ok(r.erros.some((e) => e.includes('Conflito')));
});

test('exige ao menos 2 palavras', () => {
  const r = validarGrade([{ resposta: 'SO', dica: 'x', linha: 1, coluna: 1, direcao: 'horizontal' }]);
  assert.equal(r.valido, false);
});

test('avisa sobre grade desconectada', () => {
  const palavras = [
    { resposta: 'CASA', dica: 'a', linha: 1, coluna: 1, direcao: 'horizontal' },
    { resposta: 'SOL',  dica: 'b', linha: 10, coluna: 10, direcao: 'horizontal' }
  ];
  const r = validarGrade(palavras);
  assert.equal(r.valido, true);
  assert.ok(r.avisos.length > 0);
});

test('monta matriz posicionando letras', () => {
  const m = montarMatriz([
    { resposta: 'AB', dica: 'x', linha: 1, coluna: 1, direcao: 'horizontal' }
  ]);
  assert.equal(m[0][0], 'A');
  assert.equal(m[0][1], 'B');
});
