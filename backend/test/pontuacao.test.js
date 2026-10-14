import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tentativaDoAcerto, calcularPontuacao } from '../src/services/pontuacao.js';

test('tentativa do acerto exige ficar certa ate o fim', () => {
  assert.equal(tentativaDoAcerto([true, true, true]), 1);
  assert.equal(tentativaDoAcerto([false, true]), 2);
  assert.equal(tentativaDoAcerto([false, false, true]), 3);
  assert.equal(tentativaDoAcerto([true, false, true]), 3); // estragou e voltou
  assert.equal(tentativaDoAcerto([true, false]), null);
  assert.equal(tentativaDoAcerto([]), null);
});

test('tudo de primeira, rapido, facil: pontos cheios + bonus', () => {
  // 5 palavras x 100 = 500; tempo 0 -> +20% (100); completa -> +10% (50)
  const r = calcularPontuacao({ acertos: [1, 1, 1, 1, 1], dificuldade: 'facil', tempo: 0 });
  assert.equal(r.pontuacao, 650);
  assert.deepEqual(r.detalhe.acertos_por_tentativa, { 1: 5 });
});

test('acertos em tentativas posteriores valem menos', () => {
  // 100 + 70 + 50 + 30 + 30 = 280; tempo esgotado (300s = 5 x 60) -> sem bonus de tempo
  const r = calcularPontuacao({ acertos: [1, 2, 3, 4, 7], dificuldade: 'facil', tempo: 300 });
  assert.equal(r.detalhe.pontos_palavras, 280);
  assert.equal(r.detalhe.bonus_tempo, 0);
  assert.equal(r.pontuacao, 308); // + 10% completa
});

test('incompleta: so pontos das certas, sem bonus', () => {
  const r = calcularPontuacao({ acertos: [1, 1, null, null, null], dificuldade: 'dificil', tempo: 10 });
  assert.equal(r.pontuacao, 300); // 200 x 1.5
  assert.equal(r.detalhe.completa, false);
});

test('dificuldade multiplica e tempo reduz o bonus', () => {
  const rapido = calcularPontuacao({ acertos: [1, 1, 1, 1, 1], dificuldade: 'medio', tempo: 60 });
  const lento = calcularPontuacao({ acertos: [1, 1, 1, 1, 1], dificuldade: 'medio', tempo: 240 });
  assert.equal(rapido.detalhe.pontos_palavras, 600);
  assert.ok(rapido.pontuacao > lento.pontuacao);
});
