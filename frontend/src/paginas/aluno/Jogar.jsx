// Partida: o aluno preenche a grade inteira e confere; o sistema diz so
// quantas palavras estao certas. Ao completar (ou encerrar) mostra a
// pontuacao e o gabarito.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Erro, Grade, PillDificuldade, formatarTempo } from '../../componentes/comuns.jsx';

const chave = (l, c) => `${l},${c}`;
const normalizarLetra = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Celulas de cada palavra (linha/coluna 1-indexados, como vem da API).
function celulasDa(p) {
  return Array.from({ length: p.tamanho }, (_, i) =>
    p.direcao === 'horizontal' ? chave(p.linha, p.coluna + i) : chave(p.linha + i, p.coluna)
  );
}

function Cronometro({ inicial }) {
  const [seg, setSeg] = useState(inicial);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSeg(inicial + Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inicial]);
  return <span className="cronometro">⏱ {formatarTempo(seg)}</span>;
}

function Tabuleiro({ sessao, letras, setLetras, ativa, setAtiva, reveladas }) {
  const refs = useRef(new Map());
  const palavras = useMemo(() => [...sessao.horizontais, ...sessao.verticais], [sessao]);
  const celulasPorPalavra = useMemo(() => new Map(palavras.map((p) => [p, celulasDa(p)])), [palavras]);
  const numeroEm = useMemo(() => new Map(sessao.numeros.map((n) => [chave(n.linha, n.coluna), n.numero])), [sessao]);

  const palavraEm = (k, direcao) =>
    palavras.find((p) => p.direcao === direcao && celulasPorPalavra.get(p).includes(k));

  const focar = (k) => refs.current.get(k)?.focus();

  const selecionar = (k, preferida) => {
    const p = palavraEm(k, preferida) ?? palavraEm(k, preferida === 'horizontal' ? 'vertical' : 'horizontal');
    setAtiva({ celula: k, palavra: p });
  };

  const mover = (passo) => {
    const lista = celulasPorPalavra.get(ativa.palavra);
    const i = lista.indexOf(ativa.celula) + passo;
    if (i < 0 || i >= lista.length) return null;
    setAtiva({ ...ativa, celula: lista[i] });
    focar(lista[i]);
    return lista[i];
  };

  const aoDigitar = (k, valor) => {
    const letra = normalizarLetra(valor).slice(-1);
    if (!letra) return;
    // Letra revelada por dica fica travada: so pula para a proxima casa.
    if (!reveladas.has(k)) setLetras((atual) => ({ ...atual, [k]: letra }));
    mover(1);
  };

  const aoTeclar = (e, k) => {
    const [l, c] = k.split(',').map(Number);
    const setas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && normalizarLetra(e.key)) {
      // Trata a letra aqui: se a casa ja tem a mesma letra o onChange nao
      // dispara e o cursor nao andaria. (onChange fica para teclado de celular.)
      e.preventDefault();
      aoDigitar(k, e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      // Casa vazia (ou revelada): volta uma casa e apaga a anterior.
      const alvo = letras[k] && !reveladas.has(k) ? k : mover(-1);
      if (alvo && !reveladas.has(alvo)) setLetras((atual) => ({ ...atual, [alvo]: '' }));
    } else if (setas[e.key]) {
      e.preventDefault();
      const [dl, dc] = setas[e.key];
      const destino = chave(l + dl, c + dc);
      if (refs.current.has(destino)) {
        selecionar(destino, dl ? 'vertical' : 'horizontal');
        focar(destino);
      }
    }
  };

  const celulasAtivas = new Set(ativa.palavra ? celulasPorPalavra.get(ativa.palavra) : []);

  return (
    <div className="grade-scroll">
      <table className="grade grade-jogo">
        <tbody>
          {sessao.grade.map((linha, li) => (
            <tr key={li}>
              {linha.map((cel, ci) => {
                const k = chave(li + 1, ci + 1);
                if (cel === null) return <td key={ci} className="vazia" />;
                const n = numeroEm.get(k);
                return (
                  <td
                    key={ci}
                    className={`cel ${celulasAtivas.has(k) ? 'ativa' : ''} ${ativa.celula === k ? 'foco' : ''} ${reveladas.has(k) ? 'revelada' : ''}`}
                    title={reveladas.has(k) ? 'Letra revelada por dica' : undefined}
                  >
                    {n && <span className="num">{n}</span>}
                    <input
                      ref={(el) => (el ? refs.current.set(k, el) : refs.current.delete(k))}
                      value={letras[k] ?? ''}
                      readOnly={reveladas.has(k)}
                      aria-label={`Linha ${li + 1}, coluna ${ci + 1}`}
                      autoComplete="off"
                      autoCapitalize="characters"
                      onFocus={(e) => e.target.select() /* digitar substitui a letra */}
                      onClick={() => {
                        // Clicar de novo na mesma celula troca a direcao.
                        if (ativa.celula !== k) return selecionar(k, ativa.palavra?.direcao ?? 'horizontal');
                        const outra = ativa.palavra?.direcao === 'horizontal' ? 'vertical' : 'horizontal';
                        const p = palavraEm(k, outra);
                        if (p) setAtiva({ celula: k, palavra: p });
                      }}
                      onChange={(e) => aoDigitar(k, e.target.value)}
                      onKeyDown={(e) => aoTeclar(e, k)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dicas({ sessao, ativa, aoEscolher }) {
  const bloco = (titulo, lista) => (
    <div>
      <h3>{titulo}</h3>
      <ol className="dicas dicas-jogo">
        {lista.map((p) => (
          <li
            key={`${p.direcao}-${p.numero}`}
            value={p.numero}
            className={ativa.palavra === p ? 'ativa' : ''}
            onClick={() => aoEscolher(p)}
          >
            {p.dica} <span className="muted">({p.tamanho})</span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="dicas-grid">
      {bloco('Horizontais →', sessao.horizontais)}
      {bloco('Verticais ↓', sessao.verticais)}
    </div>
  );
}

function Resultado({ sessao, jogarDeNovo }) {
  const r = sessao.resultado;
  const porTentativa = Object.entries(r.acertos_por_tentativa);
  return (
    <>
      <section className={`card resultado ${r.completa ? 'completa' : ''}`}>
        <p className="eyebrow">{r.completa ? 'Cruzada completa! 🎉' : 'Partida encerrada'}</p>
        <div className="placar">{sessao.pontuacao} <small>pontos</small></div>
        <p className="muted">
          {r.certas} de {r.total} palavras certas · {sessao.tentativas.length} conferência(s) · {formatarTempo(sessao.tempo)}
        </p>
        <table className="tabela tabela-pontos">
          <tbody>
            {porTentativa.map(([t, qtd]) => (
              <tr key={t}><td>Acertadas na {t}ª tentativa</td><td>{qtd}</td></tr>
            ))}
            {r.dicas_usadas > 0 && (
              <tr><td>Letras reveladas por dica ({r.dicas_usadas})</td><td>−{r.desconto_dicas}</td></tr>
            )}
            <tr><td>Pontos das palavras {r.multiplicador_dificuldade !== 1 && `(× ${r.multiplicador_dificuldade} pela dificuldade)`}</td><td>{r.pontos_palavras}</td></tr>
            <tr><td>Bônus de tempo</td><td>+{r.bonus_tempo}</td></tr>
            <tr><td>Bônus por completar</td><td>+{r.bonus_completa}</td></tr>
            <tr className="total"><td>Total</td><td>{sessao.pontuacao}</td></tr>
          </tbody>
        </table>
        <div className="acoes">
          <button className="btn" onClick={jogarDeNovo}>↻ Jogar de novo</button>
          <Link className="btn btn-ghost" to={`/jogos/${sessao.id_cruzada}`}>Ver ranking</Link>
        </div>
      </section>

      <div className="detalhe-grid">
        <section className="card">
          <h2>Gabarito</h2>
          <Grade matriz={sessao.gabarito.matriz} numeros={sessao.numeros} />
        </section>
        <section className="card">
          <h2>Suas respostas</h2>
          <ul className="lista-respostas">
            {[...sessao.gabarito.palavras]
              .sort((a, b) => a.numero - b.numero || a.direcao.localeCompare(b.direcao))
              .map((p) => (
                <li key={p.indice} className={p.correta ? 'certa' : 'errada'}>
                  <span>{p.correta ? '✔' : '✘'} {p.numero} {p.direcao === 'horizontal' ? '→' : '↓'}</span>
                  <strong>{p.resposta}</strong>
                  {!p.correta && <span className="muted">você: {p.informada || '—'}</span>}
                </li>
              ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export default function Jogar() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [sessao, setSessao] = useState(null);
  const [letras, setLetras] = useState({});
  const [reveladas, setReveladas] = useState(() => new Set()); // casas reveladas por dica (RN20)
  const [ativa, setAtiva] = useState({ celula: null, palavra: null });
  const [retorno, setRetorno] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const s = await api.get(`/sessoes/${id}`);
      setSessao(s);
      // Retoma a grade com as ultimas respostas enviadas.
      const preenchidas = {};
      for (const p of [...s.horizontais, ...s.verticais]) {
        const texto = s.ultimas_respostas[p.indice] ?? '';
        celulasDa(p).forEach((k, i) => {
          if (texto[i]) preenchidas[k] = texto[i];
        });
      }
      // Letras reveladas por dica valem por cima do que foi digitado.
      for (const d of s.dicas ?? []) preenchidas[chave(d.linha, d.coluna)] = d.letra;
      setReveladas(new Set((s.dicas ?? []).map((d) => chave(d.linha, d.coluna))));
      setLetras(preenchidas);
      const primeira = s.horizontais[0] ?? s.verticais[0];
      if (primeira) setAtiva({ celula: celulasDa(primeira)[0], palavra: primeira });
    } catch (e) {
      setErro(e);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const conferir = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const respostas = {};
      for (const p of [...sessao.horizontais, ...sessao.verticais]) {
        respostas[p.indice] = celulasDa(p).map((k) => letras[k] || ' ').join('').trimEnd();
      }
      const r = await api.post(`/sessoes/${id}/conferir`, { respostas });
      if (r.concluida) {
        await carregar();
      } else {
        setRetorno(r);
        setSessao((s) => ({ ...s, tentativas: [...s.tentativas, { tentativa: r.tentativa, certas: r.certas }] }));
      }
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  };

  // RN20: revela a primeira casa vazia da palavra selecionada.
  const revelarLetra = async () => {
    const p = ativa.palavra;
    if (!p) return;
    const custo = Math.round(sessao.desconto_por_letra * 100);
    const aviso =
      `Revelar uma letra de ${p.numero} ${p.direcao === 'horizontal' ? '→' : '↓'}?\n\n` +
      `Custa ${custo}% dos pontos de cada palavra que passa pela casa revelada. ` +
      `Restam ${sessao.dicas_restantes} dica(s) nesta partida.`;
    if (!confirm(aviso)) return;
    setErro(null);
    try {
      const atual = celulasDa(p).map((k) => letras[k] || ' ').join('');
      const r = await api.post(`/sessoes/${id}/dica`, { indice: p.indice, atual });
      const k = chave(r.linha, r.coluna);
      setLetras((l) => ({ ...l, [k]: r.letra }));
      setReveladas((s) => new Set(s).add(k));
      setSessao((s) => ({ ...s, dicas_restantes: r.dicas_restantes }));
    } catch (e) {
      setErro(e);
    }
  };

  const encerrar = async () => {
    const msg = sessao.tentativas.length
      ? 'Encerrar a partida? A pontuação considera o que estava certo na última conferência.'
      : 'Encerrar sem conferir nenhuma vez? A pontuação será zero.';
    if (!confirm(msg)) return;
    try {
      await api.post(`/sessoes/${id}/encerrar`);
      await carregar();
    } catch (e) {
      setErro(e);
    }
  };

  const jogarDeNovo = async () => {
    try {
      const r = await api.post(`/jogos/${sessao.id_cruzada}/sessoes`);
      navegar(`/partida/${r.id_sessao}`);
    } catch (e) {
      setErro(e);
    }
  };

  if (!sessao) return erro ? <Erro erro={erro} /> : <p className="muted">Carregando…</p>;

  const cabecalho = (
    <div className="page-head">
      <div>
        <p className="eyebrow">{sessao.disciplina}</p>
        <h1>{sessao.titulo}</h1>
        <p className="pills">
          <PillDificuldade valor={sessao.dificuldade} />
          <span className="muted">{sessao.total_palavras} palavras · v{sessao.versao}</span>
        </p>
      </div>
      {!sessao.encerrada && <Cronometro inicial={sessao.decorrido} />}
    </div>
  );

  if (sessao.encerrada) {
    return (
      <>
        {cabecalho}
        <Erro erro={erro} />
        <Resultado sessao={sessao} jogarDeNovo={jogarDeNovo} />
      </>
    );
  }

  const preenchidas = Object.values(letras).filter(Boolean).length;
  const totalCelulas = sessao.grade.flat().filter((c) => c !== null).length;
  const escolherPalavra = (p) => {
    const k = celulasDa(p)[0];
    setAtiva({ celula: k, palavra: p });
    document.querySelector(`input[aria-label="Linha ${p.linha}, coluna ${p.coluna}"]`)?.focus();
  };

  return (
    <>
      {cabecalho}
      <Erro erro={erro} />
      {retorno && (
        <div className={`alert ${retorno.certas === 0 ? 'alert-erro' : ''}`} role="status">
          Tentativa {retorno.tentativa}: <strong>{retorno.certas} de {retorno.total}</strong> palavras certas.
          {retorno.certas < retorno.total && ' Revise e confira de novo.'}
        </div>
      )}

      <div className="detalhe-grid">
        <section className="card">
          <Tabuleiro
            sessao={sessao}
            letras={letras}
            setLetras={setLetras}
            ativa={ativa}
            setAtiva={setAtiva}
            reveladas={reveladas}
          />
          {ativa.palavra && (
            <p className="dica-ativa">
              <strong>{ativa.palavra.numero} {ativa.palavra.direcao === 'horizontal' ? '→' : '↓'}</strong>{' '}
              {ativa.palavra.dica}
            </p>
          )}
          <div className="acoes">
            <button className="btn" onClick={conferir} disabled={enviando}>
              {enviando ? 'Conferindo…' : 'Conferir respostas'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={revelarLetra}
              disabled={!ativa.palavra || sessao.dicas_restantes === 0}
              title={`Revela uma letra da palavra selecionada (custa ${Math.round(sessao.desconto_por_letra * 100)}% dos pontos dela)`}
            >
              💡 Revelar letra ({sessao.dicas_restantes})
            </button>
            <button className="btn btn-ghost perigo" onClick={encerrar}>Encerrar partida</button>
            <span className="muted small">{preenchidas}/{totalCelulas} casas preenchidas</span>
          </div>
        </section>
        <section className="card">
          <Dicas sessao={sessao} ativa={ativa} aoEscolher={escolherPalavra} />
          {sessao.tentativas.length > 0 && (
            <>
              <h3>Conferências</h3>
              <ul className="historico">
                {sessao.tentativas.map((t) => (
                  <li key={t.tentativa}>
                    {t.tentativa}ª: {t.certas} de {sessao.total_palavras} certas
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <p className="muted small">
        Dica: clique numa casa ou numa dica para escolher a palavra; clique de novo na casa para trocar entre
        horizontal e vertical. Setas movem, Backspace apaga.
      </p>
    </>
  );
}
