import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casasDaPalavra, escolherCasa, reveladasPorPalavra } from '../src/services/dica.js';
import { calcularPontuacao } from '../src/services/pontuacao.js';

// PACOTE na horizontal (linha 5, colunas 2..7) e ROTEADOR na vertical
// (coluna 3, linhas 1..8): cruzam em (5,3) = 'A'.
const PACOTE = { indice: 1, resposta: 'PACOTE', linha: 5, coluna: 2, direcao: 'horizontal' };
const ROTEADOR = { indice: 2, resposta: 'ROTEADOR', linha: 1, coluna: 3, direcao: 'vertical' };

test('casas da palavra seguem a direcao', () => {
  assert.deepEqual(casasDaPalavra(PACOTE).slice(0, 2), [
    { linha: 5, coluna: 2, letra: 'P' },
    { linha: 5, coluna: 3, letra: 'A' }
  ]);
  assert.deepEqual(casasDaPalavra(ROTEADOR)[1], { linha: 2, coluna: 3, letra: 'O' });
});

test('revela a primeira casa vazia da palavra', () => {
  assert.deepEqual(escolherCasa(PACOTE, 'PA TE', new Set()), { linha: 5, coluna: 4, letra: 'C' });
  assert.deepEqual(escolherCasa(PACOTE, '', new Set()), { linha: 5, coluna: 2, letra: 'P' });
});

test('nao depende de a letra digitada estar certa (nao entrega se a palavra esta correta)', () => {
  // tudo preenchido: certo ou errado, revela a mesma casa (a primeira)
  assert.deepEqual(escolherCasa(PACOTE, 'PACOTE', new Set()), escolherCasa(PACOTE, 'XXXXXX', new Set()));
});

test('pula casas ja reveladas e devolve null quando acabam', () => {
  const reveladas = new Set(['5,2', '5,4']);
  assert.deepEqual(escolherCasa(PACOTE, '', reveladas), { linha: 5, coluna: 3, letra: 'A' });
  const todas = new Set(casasDaPalavra(PACOTE).map((c) => `${c.linha},${c.coluna}`));
  assert.equal(escolherCasa(PACOTE, '', todas), null);
});

test('letra revelada num cruzamento conta para as duas palavras', () => {
  assert.deepEqual(reveladasPorPalavra([PACOTE, ROTEADOR], [{ linha: 5, coluna: 3 }]), [1, 1]);
  assert.deepEqual(reveladasPorPalavra([PACOTE, ROTEADOR], [{ linha: 5, coluna: 2 }, { linha: 5, coluna: 4 }]), [2, 0]);
});

test('cada letra revelada tira 20% da palavra (RN20)', () => {
  // 5 palavras de primeira, facil, tempo esgotado (sem bonus de tempo):
  // sem dica 500; com 1 letra numa palavra e 2 em outra: 500 - 20 - 40 = 440
  const base = { acertos: [1, 1, 1, 1, 1], dificuldade: 'facil', tempo: 300 };
  const sem = calcularPontuacao(base);
  const com = calcularPontuacao({ ...base, reveladas: [1, 2, 0, 0, 0] });
  assert.equal(sem.detalhe.pontos_palavras, 500);
  assert.equal(com.detalhe.pontos_palavras, 440);
  assert.equal(com.detalhe.desconto_dicas, 60);
  // 5 letras zeram a palavra
  assert.equal(calcularPontuacao({ ...base, reveladas: [5, 0, 0, 0, 0] }).detalhe.pontos_palavras, 400);
});
