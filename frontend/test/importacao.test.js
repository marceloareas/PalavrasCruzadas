import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXEMPLO, interpretarTexto } from '../src/importacao.js';

test('le uma palavra por linha separada por ";"', () => {
  const r = interpretarTexto('BRASIL;País do CEFET\nATOMO;Menor parte');
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.palavras, [
    { resposta: 'BRASIL', dica: 'País do CEFET' },
    { resposta: 'ATOMO', dica: 'Menor parte' }
  ]);
});

test('o exemplo do balao e valido', () => {
  const r = interpretarTexto(EXEMPLO);
  assert.deepEqual(r.erros, []);
  assert.equal(r.palavras.length, 6);
});

test('ignora linhas vazias, comentarios, cabecalho, CRLF, BOM e espacos', () => {
  const texto = '﻿resposta;dica\r\n\r\n# comentario\r\n  sol ; Estrela do sistema  \r\n';
  const r = interpretarTexto(texto);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.palavras, [{ resposta: 'sol', dica: 'Estrela do sistema' }]);
});

test('quebra so no primeiro ";" (a dica pode ter ";") e tira aspas de CSV', () => {
  const r = interpretarTexto('"LUA";"Satélite; natural"');
  assert.deepEqual(r.palavras, [{ resposta: 'LUA', dica: 'Satélite; natural' }]);
});

test('aponta a linha dos erros', () => {
  const r = interpretarTexto('BRASIL,País\nX;curta\nMARTE;\n;sem resposta\nVÊNUS;Planeta\nvenus;Repetida', {
    minLetras: 2,
    maxLetras: 20
  });
  assert.equal(r.palavras.length, 1);
  assert.equal(r.erros.length, 5);
  assert.match(r.erros[0], /^Linha 1: falta o ";"/);
  assert.match(r.erros[1], /^Linha 2: "X" tem 1 letras/);
  assert.match(r.erros[2], /^Linha 3: falta a dica/);
  assert.match(r.erros[3], /^Linha 4: a resposta está vazia/);
  assert.match(r.erros[4], /^Linha 6: "venus" repete a linha 5/);
});

test('respeita o tamanho maximo da dica', () => {
  const r = interpretarTexto(`SOL;${'a'.repeat(11)}`, { maxDica: 10 });
  assert.match(r.erros[0], /passa de 10 caracteres/);
});

