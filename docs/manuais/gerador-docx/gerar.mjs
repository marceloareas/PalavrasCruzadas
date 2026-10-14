// ============================================================================
// Gera manual-desenvolvedor.docx e manual-usuario.docx a partir do Markdown.
//
//   cd docs/manuais/gerador-docx && npm install && npm run gerar
//
// Suporta o subconjunto de Markdown usado nos manuais: titulos, paragrafos,
// **negrito**, `codigo`, [links](url), listas, tabelas, citacoes (>),
// blocos de codigo, imagens e blocos ```mermaid (renderizados com o Chrome).
// Links relativos viram links para o GitHub (branch dev).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel,
  ImageRun, LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table,
  TableCell, TableOfContents, TableRow, TextRun, WidthType
} from 'docx';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MANUAIS = path.resolve(AQUI, '..');
const REPO_URL = 'https://github.com/marceloareas/PalavrasCruzadas/blob/dev/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const COR = { marca: '5936D9', texto: '191B2E', suave: '6B7185', linha: 'D9DAE6', fundoTab: 'EFEAFE', codigo: 'F4F4F8' };
const FONTE = 'Calibri';
const LARGURA = 9638; // A4 (11906) - margens de 2 cm (2 x 1134), em DXA
const LARGURA_PX = 620; // largura maxima das imagens

// ---------------------------------------------------------------------------
// Mermaid -> PNG
// ---------------------------------------------------------------------------
async function renderizarMermaid(blocos) {
  if (!blocos.length) return [];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const p = await browser.newPage();
  await p.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
  await p.setContent('<body style="margin:0;background:#fff"><div id="d" style="display:inline-block;padding:12px;background:#fff"></div></body>');
  await p.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js' });
  await p.evaluate(() => mermaid.initialize({ startOnLoad: false, theme: 'default', fontFamily: 'Calibri, Arial, sans-serif' }));
  const imagens = [];
  for (const [i, codigo] of blocos.entries()) {
    await p.evaluate(async (c, id) => {
      const { svg } = await mermaid.render(id, c);
      document.getElementById('d').innerHTML = svg;
      const s = document.querySelector('#d svg');
      // Usa o tamanho natural do diagrama (sem encolher para a janela).
      const vb = s.viewBox.baseVal;
      s.removeAttribute('style');
      s.setAttribute('width', vb.width);
      s.setAttribute('height', vb.height);
    }, codigo, 'm' + i);
    const el = await p.$('#d');
    imagens.push(Buffer.from(await el.screenshot({ type: 'png' })));
  }
  await browser.close();
  return imagens;
}

const dimensoesPng = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

// ---------------------------------------------------------------------------
// Markdown -> blocos
// ---------------------------------------------------------------------------
function analisar(md) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^```(\w*)/))) {
      const conteudo = [];
      i++;
      while (i < linhas.length && !linhas[i].startsWith('```')) conteudo.push(linhas[i++]);
      i++;
      blocos.push(m[1] === 'mermaid' ? { tipo: 'mermaid', codigo: conteudo.join('\n') } : { tipo: 'codigo', linhas: conteudo });
    } else if ((m = l.match(/^(#{1,4}) (.+)/))) {
      blocos.push({ tipo: 'titulo', nivel: m[1].length, texto: m[2] }); i++;
    } else if ((m = l.match(/^!\[(.*?)\]\((.+?)\)/))) {
      blocos.push({ tipo: 'imagem', alt: m[1], src: m[2] }); i++;
    } else if (l.startsWith('|')) {
      const t = [];
      while (i < linhas.length && linhas[i].startsWith('|')) t.push(linhas[i++]);
      const celulas = (x) => x.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
      blocos.push({ tipo: 'tabela', cab: celulas(t[0]), linhas: t.slice(2).map(celulas) });
    } else if (l.startsWith('>')) {
      const q = [];
      while (i < linhas.length && linhas[i].startsWith('>')) q.push(linhas[i++].replace(/^>\s?/, ''));
      blocos.push({ tipo: 'citacao', texto: q.join(' ') });
    } else if (/^(\s*)([-*]|\d+\.) /.test(l)) {
      const itens = [];
      const numerada = /^\s*\d+\./.test(l);
      const inicio = numerada ? Number.parseInt(l.trim(), 10) : 1;
      while (i < linhas.length && linhas[i].trim() && !/^(#|\||```|>|!\[)/.test(linhas[i])) {
        if (/^\s*([-*]|\d+\.) /.test(linhas[i])) itens.push(linhas[i].replace(/^\s*([-*]|\d+\.) /, ''));
        else itens[itens.length - 1] += ' ' + linhas[i].trim(); // continuacao
        i++;
      }
      blocos.push({ tipo: 'lista', numerada, inicio, itens });
    } else {
      const par = [];
      while (i < linhas.length && linhas[i].trim() && !/^(#{1,4} |\||```|>|!\[|\s*([-*]|\d+\.) )/.test(linhas[i])) par.push(linhas[i++].trim());
      blocos.push({ tipo: 'paragrafo', texto: par.join(' ') });
    }
  }
  return blocos;
}

// ---------------------------------------------------------------------------
// Texto com **negrito**, `codigo` e [links](url)
// ---------------------------------------------------------------------------
function urlAbsoluta(url) {
  if (/^https?:/.test(url)) return url;
  const [arquivo, ancora] = url.split('#');
  const rel = path.posix.normalize(path.posix.join('docs/manuais', arquivo));
  return REPO_URL + rel + (ancora ? '#' + ancora : '');
}

function inline(texto, base = {}) {
  const runs = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s)|]+|\*([^*\s][^*]*)\*)/g;
  let ultimo = 0;
  let m;
  const comum = (t, extra = {}) => new TextRun({ text: t, font: FONTE, color: COR.texto, ...base, ...extra });
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) runs.push(comum(texto.slice(ultimo, m.index)));
    if (m[2] !== undefined) runs.push(...inline(m[2], { ...base, bold: true }));
    else if (m[6] !== undefined) runs.push(...inline(m[6], { ...base, italics: true }));
    else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], font: 'Consolas', size: (base.size ?? 22) - 2, color: '3730A3', shading: { type: ShadingType.CLEAR, color: 'auto', fill: COR.codigo } }));
    } else {
      const rotulo = m[4] ?? m[0];
      const url = urlAbsoluta(m[5] ?? m[0]);
      runs.push(new ExternalHyperlink({ link: url, children: [comum(rotulo, { color: COR.marca, underline: {} })] }));
    }
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) runs.push(comum(texto.slice(ultimo)));
  return runs;
}

// ---------------------------------------------------------------------------
// Blocos -> elementos do docx
// ---------------------------------------------------------------------------
function construir(blocos, imagensMermaid, pastaMd) {
  const filhos = [];
  const listas = [];
  let nFigura = 0;
  let nMermaid = 0;
  const ultimoTitulo = { texto: '' };

  const legenda = (texto) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 240 },
      children: [new TextRun({ text: `Figura ${++nFigura} — ${texto}`, italics: true, size: 18, color: COR.suave, font: FONTE })]
    });

  const imagem = (buf, maxAltura = 820) => {
    const { w, h } = dimensoesPng(buf);
    let largura = Math.min(LARGURA_PX, w / 2);
    let altura = (h * largura) / w;
    if (altura > maxAltura) { altura = maxAltura; largura = (w * altura) / h; }
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      keepNext: true,
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(largura), height: Math.round(altura) } })]
    });
  };

  for (const b of blocos) {
    switch (b.tipo) {
      case 'titulo': {
        if (b.nivel === 1) break; // o titulo do documento vai na capa
        ultimoTitulo.texto = b.texto.replace(/^[\d.]+\s*/, '').replace(/`/g, '');
        ultimoTitulo.rotulo = null;
        const nivel = { 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 }[b.nivel];
        filhos.push(new Paragraph({ heading: nivel, children: inline(b.texto) }));
        break;
      }
      case 'paragrafo': {
        // "**Rotulo** texto:" introduz a figura seguinte (vira a legenda dela).
        const rotulo = b.texto.match(/^\*\*(.+?)\*\*/);
        ultimoTitulo.rotulo = rotulo && b.texto.trim().endsWith(':') ? rotulo[1] : null;
        filhos.push(new Paragraph({
          spacing: { after: 140, line: 288 },
          keepNext: b.texto.trim().endsWith(':'), // nao separa a introducao do que vem depois
          children: inline(b.texto)
        }));
        break;
      }
      case 'citacao':
        filhos.push(new Paragraph({
          spacing: { before: 120, after: 160, line: 288 },
          indent: { left: 240, right: 240 },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F2FE' },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: COR.marca, space: 8 } },
          children: inline(b.texto)
        }));
        break;
      case 'lista': {
        const ref = b.numerada ? `num-${listas.length}` : 'marcador';
        if (b.numerada) listas.push({ ref, inicio: b.inicio });
        for (const item of b.itens) {
          filhos.push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 276 }, children: inline(item) }));
        }
        filhos.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      }
      case 'codigo':
        b.linhas.forEach((linha, k) => {
          filhos.push(new Paragraph({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: COR.codigo },
            spacing: { before: k === 0 ? 120 : 0, after: k === b.linhas.length - 1 ? 200 : 0, line: 240 },
            indent: { left: 120, right: 120 },
            keepLines: true,
            children: [new TextRun({ text: linha || ' ', font: 'Consolas', size: 17, color: '1F2937' })]
          }));
        });
        break;
      case 'imagem': {
        const buf = fs.readFileSync(path.join(pastaMd, b.src));
        filhos.push(imagem(buf), legenda(b.alt));
        break;
      }
      case 'mermaid': {
        const buf = imagensMermaid[nMermaid++];
        const nomeFigura = ultimoTitulo.rotulo ? `${ultimoTitulo.texto} — ${ultimoTitulo.rotulo}` : ultimoTitulo.texto;
        filhos.push(imagem(buf, 930), legenda(`Diagrama: ${nomeFigura}`));
        ultimoTitulo.rotulo = null;
        break;
      }
      case 'tabela': {
        const n = b.cab.length;
        // Largura das colunas proporcional ao conteudo (com minimo).
        const pesos = b.cab.map((c, j) => {
          const maior = Math.max(c.length, ...b.linhas.map((l) => (l[j] ?? '').replace(/[*`]/g, '').length));
          return Math.min(Math.max(maior, 6), 60);
        });
        const soma = pesos.reduce((a, x) => a + x, 0);
        const larguras = pesos.map((p) => Math.floor((p / soma) * LARGURA));
        larguras[n - 1] += LARGURA - larguras.reduce((a, x) => a + x, 0);
        const borda = { style: BorderStyle.SINGLE, size: 4, color: COR.linha };
        const celula = (texto, j, cab) => new TableCell({
          width: { size: larguras[j], type: WidthType.DXA },
          shading: cab ? { type: ShadingType.CLEAR, color: 'auto', fill: COR.fundoTab } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders: { top: borda, bottom: borda, left: borda, right: borda },
          children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: inline(texto.replace(/\\\|/g, '|'), { size: 19, bold: cab || undefined }) })]
        });
        filhos.push(new Table({
          width: { size: LARGURA, type: WidthType.DXA },
          columnWidths: larguras,
          rows: [
            new TableRow({ tableHeader: true, children: b.cab.map((c, j) => celula(c, j, true)) }),
            ...b.linhas.map((l) => new TableRow({ cantSplit: true, children: b.cab.map((_, j) => celula(l[j] ?? '', j, false)) }))
          ]
        }));
        filhos.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
      }
    }
  }
  return { filhos, listas };
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------
async function gerar(arquivoMd, arquivoDocx) {
  const md = fs.readFileSync(path.join(MANUAIS, arquivoMd), 'utf8');
  const blocos = analisar(md);
  const imagensMermaid = await renderizarMermaid(blocos.filter((b) => b.tipo === 'mermaid').map((b) => b.codigo));

  const titulo = blocos.find((b) => b.tipo === 'titulo' && b.nivel === 1).texto;
  const [nome, sub] = titulo.split(' — ');
  // Linhas "**Campo:** valor" antes da primeira secao vao para a capa.
  const primeiraSecao = blocos.findIndex((b) => b.tipo === 'titulo' && b.nivel === 2);
  const infoCapa = blocos.slice(0, primeiraSecao).filter((b) => b.tipo === 'paragrafo')
    .flatMap((b) => b.texto.split(/ (?=\*\*[^*]+:\*\*)/));
  const corpo = blocos.slice(primeiraSecao);

  const { filhos, listas } = construir(corpo, imagensMermaid, MANUAIS);

  const capa = [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: 'CRUZADINHA DIGITAL', bold: true, size: 28, color: COR.marca, font: FONTE, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: nome, bold: true, size: 60, color: COR.texto, font: FONTE })] }),
    new Paragraph({
      spacing: { after: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COR.marca, space: 12 } },
      children: [new TextRun({ text: sub ?? '', size: 30, color: COR.suave, font: FONTE })]
    }),
    ...infoCapa.map((t) => new Paragraph({ spacing: { after: 100 }, children: inline(t, { size: 22 }) })),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Sumário', bold: true, size: 34, color: COR.marca, font: FONTE })] }),
    new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  const numeracao = [
    { reference: 'marcador', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    ...listas.map(({ ref, inicio }) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', start: inicio, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }))
  ];

  const doc = new Document({
    creator: 'Cruzadinha Digital',
    title: titulo,
    description: sub,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONTE, size: 22, color: COR.texto } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 34, bold: true, color: COR.marca, font: FONTE },
          paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 27, bold: true, color: COR.texto, font: FONTE },
          paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 23, bold: true, color: COR.marca, font: FONTE },
          paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 2 } }
      ]
    },
    numbering: { config: numeracao },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } },
        titlePage: true
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Cruzadinha Digital · ${nome}`, size: 16, color: COR.suave, font: FONTE })] })] }),
        first: new Header({ children: [] })
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: COR.suave, font: FONTE })
        ] })] }),
        first: new Footer({ children: [] })
      },
      children: [...capa, ...filhos]
    }]
  });

  fs.writeFileSync(path.join(MANUAIS, arquivoDocx), await Packer.toBuffer(doc));
  console.log(`${arquivoDocx}: ${blocos.length} blocos, ${imagensMermaid.length} diagramas`);
}

await gerar('manual-desenvolvedor.md', 'Manual do Desenvolvedor - Cruzadinha Digital.docx');
await gerar('manual-usuario.md', 'Manual do Usuario - Cruzadinha Digital.docx');
