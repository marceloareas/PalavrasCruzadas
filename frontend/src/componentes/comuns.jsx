// Pecas pequenas reaproveitadas pelas paginas.

export function Erro({ erro }) {
  if (!erro) return null;
  return (
    <div className="alert alert-erro" role="alert">
      <strong>{erro.message}</strong>
      {erro.erros?.length > 0 && (
        <ul>
          {erro.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Aviso({ tipo = 'ok', children }) {
  if (!children) return null;
  return <div className={`alert alert-${tipo}`}>{children}</div>;
}

const DIFICULDADE = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
const STATUS = { rascunho: 'Rascunho', publicado: 'Publicado', arquivado: 'Arquivado' };

export const PillDificuldade = ({ valor }) => (
  <span className={`pill pill-${valor}`}>{DIFICULDADE[valor] ?? valor}</span>
);
export const PillStatus = ({ valor }) => <span className={`pill pill-${valor}`}>{STATUS[valor] ?? valor}</span>;

export const OPCOES_DIFICULDADE = Object.entries(DIFICULDADE);
export const OPCOES_STATUS = Object.entries(STATUS);

export const formatarTempo = (s) => (s == null ? '—' : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);
export const formatarData = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Grade da cruzada.
 * matriz: celulas null (bloqueada), '' (vazia, visao do aluno) ou letra.
 * numeros: [{numero, linha, coluna}] para o numerozinho no canto.
 */
export function Grade({ matriz, numeros = [] }) {
  const numeroEm = new Map(numeros.map((n) => [`${n.linha},${n.coluna}`, n.numero]));
  return (
    <div className="grade-scroll">
      <table className="grade">
        <tbody>
          {matriz.map((linha, l) => (
            <tr key={l}>
              {linha.map((cel, c) => {
                const n = numeroEm.get(`${l + 1},${c + 1}`);
                return cel === null ? (
                  <td key={c} className="vazia" />
                ) : (
                  <td key={c} className="cel">
                    {n && <span className="num">{n}</span>}
                    {cel}
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

// Ranking da cruzada (melhor partida de cada aluno).
export function Ranking({ linhas, destacar }) {
  if (!linhas?.length) return <p className="muted">Ninguém terminou esta cruzada ainda.</p>;
  const medalha = ['🥇', '🥈', '🥉'];
  return (
    <div className="tabela-scroll">
      <table className="tabela">
        <thead>
          <tr><th>#</th><th>Aluno</th><th>Pontos</th><th>Certas</th><th>Conferências</th><th>Tempo</th></tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.id_aluno} className={r.id_aluno === destacar ? 'destaque' : ''}>
              <td>{medalha[r.posicao - 1] ?? r.posicao}</td>
              <td>{r.nome} <span className="muted">@{r.usertag}</span></td>
              <td><strong>{r.pontuacao}</strong></td>
              <td>{r.acertos}/{r.qtd_palavras}</td>
              <td>{r.tentativas}</td>
              <td>{formatarTempo(r.tempo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Lista de dicas separada em horizontais / verticais.
export function ListaDicas({ horizontais, verticais, mostrarResposta = false }) {
  const bloco = (titulo, lista) => (
    <div>
      <h3>{titulo}</h3>
      <ol className="dicas">
        {lista.map((p) => (
          <li key={`${p.direcao}-${p.numero}`} value={p.numero}>
            {mostrarResposta && <strong className="resposta">{p.resposta}</strong>}
            <span>{p.dica}</span>
            <span className="muted"> ({p.tamanho ?? p.resposta.length} letras)</span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="dicas-grid">
      {bloco('Horizontais →', horizontais)}
      {bloco('Verticais ↓', verticais)}
    </div>
  );
}
