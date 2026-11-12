import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  nomeDoJogo, dataDoDia, montarSeed, hashLudica, hashEntradaValido, papelDoTipo,
  urlRetornoValida, camposDeEntrada, corpoDaVolta, configLudica
} from '../src/services/ludica.js';

beforeEach(() => {
  delete process.env.LUDICA_NOME_JOGO;
});

// 11/11/2026 12:00 em Sao Paulo (UTC-3)
const MEIO_DIA = new Date('2026-11-11T15:00:00Z');

// Exemplos do guia do Ludica (Documents/Integracao/Guia_Integracao_Jogos.md, secao 2).
test('bate com os exemplos do guia do Ludica', () => {
  assert.equal(
    hashLudica('JOGAR', 'alice', '11112026', 'PALAVRASCRUZADAS'),
    '453b912a88e7156c1f89aea5397d7ff25e97f1ad2ed06ae8cdf751ee40dc58be'
  );
  assert.equal(
    hashLudica('JOGOU', 'alice', '11112026', 'PALAVRASCRUZADAS'),
    '61a7821879f642daaf4eadbbac6a5ad5dfaad422f568087f44caca01aeeac1f0'
  );
});

test('seed no formato LUD1C@-NOMEJOGO-ACAO-GAMERTAG-DDMMAAAA', () => {
  assert.equal(montarSeed('CRUZADINHA', 'JOGAR', 'alice', '11112026'), 'LUD1C@-CRUZADINHA-JOGAR-alice-11112026');
});

test('nome do jogo: maiusculo, sem acento, sem espaco; padrao CRUZADINHA', () => {
  assert.equal(nomeDoJogo('Palavras Cruzadas'), 'PALAVRASCRUZADAS');
  assert.equal(nomeDoJogo('Cruzadinha Lúdica!'), 'CRUZADINHALUDICA');
  assert.equal(configLudica().nomeJogo, 'CRUZADINHA');
  process.env.LUDICA_NOME_JOGO = 'Palavras Cruzadas';
  assert.equal(configLudica().nomeJogo, 'PALAVRASCRUZADAS');
});

test('data DDMMAAAA no horario de Brasilia, nao em UTC', () => {
  assert.equal(dataDoDia(MEIO_DIA), '11112026');
  // 01:30 UTC do dia 12 ainda e dia 11 em Sao Paulo
  assert.equal(dataDoDia(new Date('2026-11-12T01:30:00Z')), '11112026');
  // dia e mes com dois digitos
  assert.equal(dataDoDia(new Date('2026-03-05T15:00:00Z')), '05032026');
});

test('hash de entrada: so o de hoje, do nosso jogo, da mesma gamertag', () => {
  const hoje = hashLudica('JOGAR', 'alice', '11112026');
  assert.ok(hashEntradaValido('alice', hoje, MEIO_DIA));
  assert.ok(hashEntradaValido('alice', hoje.toUpperCase(), MEIO_DIA));
  assert.ok(!hashEntradaValido('alice', hashLudica('JOGAR', 'alice', '10112026'), MEIO_DIA), 'ontem');
  assert.ok(!hashEntradaValido('alice', hashLudica('JOGOU', 'alice', '11112026'), MEIO_DIA), 'hash de volta');
  assert.ok(!hashEntradaValido('alice', hashLudica('JOGAR', 'alice', '11112026', 'OUTROJOGO'), MEIO_DIA));
  assert.ok(!hashEntradaValido('bob', hoje, MEIO_DIA));
  assert.ok(!hashEntradaValido('alice', '', MEIO_DIA));
});

test('tipo_usuario vira papel; administrador do Ludica joga como aluno', () => {
  assert.equal(papelDoTipo('aluno'), 'aluno');
  assert.equal(papelDoTipo('Professor'), 'professor');
  assert.equal(papelDoTipo('administrador'), 'aluno');
  assert.equal(papelDoTipo('2'), null);
  assert.equal(papelDoTipo(undefined), null);
});

test('url_retorno so http(s)', () => {
  assert.ok(urlRetornoValida('http://localhost:3000/integracao/resultados'));
  assert.ok(urlRetornoValida('https://ludica.exemplo/integracao/resultados'));
  assert.ok(!urlRetornoValida('javascript:alert(1)'));
  assert.ok(!urlRetornoValida('nao e url'));
});

test('campos simulados da entrada passam na validacao', () => {
  const c = camposDeEntrada({ tipo_usuario: 'aluno', email: 'a@b.com', gamertag: 'alice', url_retorno: 'http://x/r' });
  assert.equal(c.jogo, 'CRUZADINHA');
  assert.equal(c.data, dataDoDia());
  assert.ok(hashEntradaValido('alice', c.hash));
});

test('volta: 6 campos na ordem do guia, inteiros e hash JOGOU', () => {
  const corpo = corpoDaVolta({ gamertag: 'alice', pontos: 772.4, tempoSegundos: 180.6 }, MEIO_DIA);
  assert.deepEqual(Object.keys(corpo), ['jogo', 'gamertag', 'data', 'pontos', 'tempo_segundos', 'hash']);
  assert.equal(corpo.jogo, 'CRUZADINHA');
  assert.equal(corpo.data, '11112026');
  assert.equal(corpo.pontos, 772);
  assert.equal(corpo.tempo_segundos, 181);
  assert.equal(corpo.hash, hashLudica('JOGOU', 'alice', '11112026', 'CRUZADINHA'));
  assert.equal(corpoDaVolta({ gamertag: 'a', pontos: -5, tempoSegundos: null }).pontos, 0);
});
