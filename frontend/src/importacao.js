// Importacao de palavras por texto colado (ou arquivo .txt/.csv).
// Formato: uma palavra por linha, "RESPOSTA;dica" (separador ";").
// Funcao pura, sem React, para poder ser testada com `node --test`.

export const SEPARADOR = ';';

export const EXEMPLO = [
  'BRASIL;País onde fica o CEFET-RJ',
  'ATOMO;Menor parte de um elemento químico',
  'SATURNO;Planeta famoso pelos seus anéis',
  'OXIGENIO;Gás que respiramos',
  'TRIANGULO;Polígono de três lados',
  'RIO;Curso de água que deságua no mar'
].join('\n');

// Mesma normalizacao da API (backend/src/services/gerador.js): sem acento,
// maiuscula, so letras e numeros. Usada aqui so para contar as letras.
const normalizar = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

// Cabecalho opcional, comum em planilhas exportadas como CSV.
const ehCabecalho = (resposta, dica) =>
  /^resposta$/i.test(resposta) && /^dica$/i.test(dica);

/**
 * Le o texto colado pelo professor.
 * - linhas em branco e linhas comecando com "#" sao ignoradas;
 * - a linha e quebrada no PRIMEIRO ";" (a dica pode conter ";");
 * - aspas em volta dos campos (comum em CSV) sao removidas.
 *
 * @param {string} texto
 * @param {{minLetras?: number, maxLetras?: number, maxDica?: number}} regras
 * @returns {{ palavras: Array<{resposta: string, dica: string}>, erros: string[] }}
 */
export function interpretarTexto(texto, regras = {}) {
  const minLetras = regras.minLetras ?? 2;
  const maxLetras = regras.maxLetras ?? 20;
  const maxDica = regras.maxDica ?? 300;

  const palavras = [];
  const erros = [];
  const vistas = new Map();
  const tirarAspas = (s) => s.trim().replace(/^"(.*)"$/s, '$1').trim();

  String(texto ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((bruta, i) => {
      const linha = bruta.trim();
      const n = i + 1;
      if (!linha || linha.startsWith('#')) return;

      const pos = linha.indexOf(SEPARADOR);
      if (pos < 0) {
        erros.push(`Linha ${n}: falta o ";" separando a resposta da dica ("${linha}").`);
        return;
      }
      const resposta = tirarAspas(linha.slice(0, pos));
      const dica = tirarAspas(linha.slice(pos + 1));
      if (palavras.length === 0 && erros.length === 0 && ehCabecalho(resposta, dica)) return;

      const letras = normalizar(resposta);
      if (!letras) {
        erros.push(`Linha ${n}: a resposta está vazia.`);
        return;
      }
      if (letras.length < minLetras || letras.length > maxLetras) {
        erros.push(`Linha ${n}: "${resposta}" tem ${letras.length} letras (use de ${minLetras} a ${maxLetras}).`);
        return;
      }
      if (!dica) {
        erros.push(`Linha ${n}: falta a dica de "${resposta}".`);
        return;
      }
      if (dica.length > maxDica) {
        erros.push(`Linha ${n}: a dica de "${resposta}" passa de ${maxDica} caracteres.`);
        return;
      }
      if (vistas.has(letras)) {
        erros.push(`Linha ${n}: "${resposta}" repete a linha ${vistas.get(letras)}.`);
        return;
      }
      vistas.set(letras, n);
      palavras.push({ resposta, dica });
    });

  return { palavras, erros };
}

