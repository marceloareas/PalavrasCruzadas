// Formulario de cruzada: adicionar/remover palavras e pre-visualizar a grade.
(function () {
  const lista = document.getElementById('palavras');
  const tpl = document.getElementById('tpl-palavra');
  const addBtn = document.getElementById('add-palavra');
  const preview = document.getElementById('preview');
  const previewMsg = document.getElementById('preview-msg');

  function normalizar(txt) {
    return (txt || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function coletarPalavras() {
    return Array.from(lista.querySelectorAll('.palavra-row')).map((row) => ({
      resposta: normalizar(row.querySelector('.in-resposta').value),
      linha: parseInt(row.querySelector('.in-linha').value, 10),
      coluna: parseInt(row.querySelector('.in-coluna').value, 10),
      direcao: row.querySelector('.in-direcao').value
    })).filter((p) => p.resposta.length > 0);
  }

  function atualizarContador() {
    const contador = document.getElementById('contador');
    if (contador) {
      const n = lista.querySelectorAll('.palavra-row').length;
      contador.textContent = n + (n === 1 ? ' cadastrada' : ' cadastradas');
    }
  }

  function atualizarPreview() {
    atualizarContador();
    const palavras = coletarPalavras();
    if (palavras.length === 0) {
      preview.innerHTML = '<p class="muted">Digite as palavras para ver a grade.</p>';
      previewMsg.textContent = '';
      return;
    }

    const grade = new Map();
    let maxL = 0, maxC = 0, conflito = false;
    for (const p of palavras) {
      if (!p.linha || !p.coluna) continue;
      for (let i = 0; i < p.resposta.length; i++) {
        const l = p.direcao === 'horizontal' ? p.linha : p.linha + i;
        const c = p.direcao === 'horizontal' ? p.coluna + i : p.coluna;
        maxL = Math.max(maxL, l); maxC = Math.max(maxC, c);
        const chave = l + ',' + c;
        const letra = p.resposta[i];
        if (grade.has(chave) && grade.get(chave) !== letra) conflito = true;
        grade.set(chave, grade.has(chave) && grade.get(chave) !== letra ? '?' : letra);
      }
    }

    let html = '<table class="grade">';
    for (let l = 1; l <= maxL; l++) {
      html += '<tr>';
      for (let c = 1; c <= maxC; c++) {
        const v = grade.get(l + ',' + c);
        const cls = v ? (v === '?' ? 'cel conflito' : 'cel') : 'cel vazia';
        html += '<td class="' + cls + '">' + (v || '') + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    preview.innerHTML = html;
    previewMsg.textContent = conflito
      ? '⚠ Há conflito de intersecção (letras diferentes na mesma célula).'
      : '✓ Sem conflitos aparentes. A validação final ocorre ao salvar.';
    previewMsg.className = 'preview-msg ' + (conflito ? 'msg-erro' : 'msg-ok');
  }

  addBtn?.addEventListener('click', () => {
    lista.appendChild(tpl.content.cloneNode(true));
    atualizarPreview();
  });

  lista?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-palavra')) {
      const rows = lista.querySelectorAll('.palavra-row');
      if (rows.length > 1) {
        e.target.closest('.palavra-row').remove();
        atualizarPreview();
      }
    }
  });

  lista?.addEventListener('input', atualizarPreview);
  document.addEventListener('DOMContentLoaded', atualizarPreview);
  atualizarPreview();
})();
