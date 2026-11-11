import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { dataDoDia, tokenLudica, tokenValido, papelDoPerfil, linkDeEntrada } from '../src/services/ludica.js';

beforeEach(() => {
  process.env.LUDICA_SEGREDO = 'palavra';
  process.env.LUDICA_HASH = 'sha256';
  process.env.LUDICA_FUSO = 'America/Sao_Paulo';
  delete process.env.LUDICA_PERFIL_PROFESSOR;
  delete process.env.LUDICA_PERFIL_ALUNO;
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// 11/11/2026 12:00 em Sao Paulo (UTC-3)
const MEIO_DIA = new Date('2026-11-11T15:00:00Z');

test('data do dia no fuso do Ludica, nao em UTC', () => {
  assert.equal(dataDoDia(MEIO_DIA), '2026-11-11');
  // 01:30 UTC do dia 12 ainda e dia 11 em Sao Paulo
  assert.equal(dataDoDia(new Date('2026-11-12T01:30:00Z')), '2026-11-11');
});

test('token = sha256(gamertag + data + palavra) em hex', () => {
  assert.equal(tokenLudica('aluno.bruno', '2026-11-11', 'palavra'), sha256('aluno.bruno2026-11-11palavra'));
});

test('aceita o token de hoje e o de ontem; recusa anteontem', () => {
  const t = (data) => tokenLudica('aluno.bruno', data, 'palavra');
  assert.ok(tokenValido('aluno.bruno', t('2026-11-11'), MEIO_DIA));
  assert.ok(tokenValido('aluno.bruno', t('2026-11-10'), MEIO_DIA));
  assert.ok(!tokenValido('aluno.bruno', t('2026-11-09'), MEIO_DIA));
});

test('nao diferencia maiusculas no hex', () => {
  const t = tokenLudica('aluno.bruno', '2026-11-11', 'palavra').toUpperCase();
  assert.ok(tokenValido('aluno.bruno', t, MEIO_DIA));
});

test('token de outra gamertag, palavra errada ou vazio e recusado', () => {
  assert.ok(!tokenValido('aluno.bruno', tokenLudica('aluno.duda', '2026-11-11', 'palavra'), MEIO_DIA));
  assert.ok(!tokenValido('aluno.bruno', tokenLudica('aluno.bruno', '2026-11-11', 'outra'), MEIO_DIA));
  assert.ok(!tokenValido('aluno.bruno', '', MEIO_DIA));
  assert.ok(!tokenValido('aluno.bruno', 'abc', MEIO_DIA));
});

test('sem LUDICA_SEGREDO ninguem entra', () => {
  process.env.LUDICA_SEGREDO = '';
  assert.ok(!tokenValido('aluno.bruno', tokenLudica('aluno.bruno', '2026-11-11', ''), MEIO_DIA));
});

test('perfil numerico vira papel (configuravel); desconhecido -> null', () => {
  assert.equal(papelDoPerfil(1), 'professor');
  assert.equal(papelDoPerfil('2'), 'aluno');
  assert.equal(papelDoPerfil(3), null);
  assert.equal(papelDoPerfil(undefined), null);
  process.env.LUDICA_PERFIL_PROFESSOR = '10';
  assert.equal(papelDoPerfil(10), 'professor');
  assert.equal(papelDoPerfil(1), null);
});

test('link gerado passa na validacao', () => {
  const url = new URL(linkDeEntrada({ perfil: 2, email: 'a@b.com', gamertag: 'aluno.bruno' }, 'http://x'));
  assert.equal(url.pathname, '/api/auth/ludica');
  assert.ok(tokenValido(url.searchParams.get('gamertag'), url.searchParams.get('token')));
});
