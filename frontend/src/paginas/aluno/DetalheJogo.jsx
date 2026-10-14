// Detalhe de um jogo para o aluno: grade vazia + dicas, sem respostas (RN11).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Erro, Grade, ListaDicas, PillDificuldade, formatarData, formatarTempo } from '../../componentes/comuns.jsx';

export default function DetalheJogo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [j, setJ] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get(`/jogos/${id}`).then(setJ).catch(setErro);
  }, [id]);

  if (!j) return erro ? <Erro erro={erro} /> : <p className="muted">Carregando…</p>;

  return (
    <>
      <p><button className="link" onClick={() => navegar(-1)}>← Voltar à busca</button></p>
      <div className="page-head">
        <div>
          <p className="eyebrow">{j.disciplina}</p>
          <h1>{j.titulo}</h1>
          <p className="pills">
            <PillDificuldade valor={j.dificuldade} /> <span className="code-tag">🔑 {j.codigo_acesso}</span>{' '}
            <span className="muted">Prof. {j.autor_nome}</span>
          </p>
        </div>
        <button className="btn" disabled title="A resolução do jogo entra na próxima sprint">
          ▶ Jogar (em breve)
        </button>
      </div>
      {j.descricao && <p>{j.descricao}</p>}

      <div className="detalhe-grid">
        <section className="card">
          <h2>Tabuleiro</h2>
          <Grade matriz={j.grade} numeros={j.numeros} />
        </section>
        <section className="card">
          <ListaDicas horizontais={j.horizontais} verticais={j.verticais} />
        </section>
      </div>

      <section className="card versoes">
        <h3>Minhas partidas</h3>
        {j.minhas_sessoes.length === 0 ? (
          <p className="muted">Você ainda não jogou esta cruzada.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Data</th><th>Versão</th><th>Tempo</th><th>Acertos</th><th>Erros</th><th>Pontos</th></tr>
            </thead>
            <tbody>
              {j.minhas_sessoes.map((s) => (
                <tr key={s.id_sessao}>
                  <td>{formatarData(s.inicio)}</td>
                  <td>v{s.numero_versao}</td>
                  <td>{formatarTempo(s.tempo)}</td>
                  <td>{s.acertos}</td>
                  <td>{s.erros}</td>
                  <td>{Number(s.pontuacao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
