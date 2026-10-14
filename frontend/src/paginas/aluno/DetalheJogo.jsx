// Detalhe de um jogo para o aluno: grade vazia + dicas, sem respostas (RN11),
// ranking e historico das proprias partidas.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useSessao } from '../../Sessao.jsx';
import { Erro, Grade, ListaDicas, PillDificuldade, Ranking, formatarData, formatarTempo } from '../../componentes/comuns.jsx';

export default function DetalheJogo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const [j, setJ] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get(`/jogos/${id}`).then(setJ).catch(setErro);
  }, [id]);

  // RN10: pode jogar quantas vezes quiser; se houver partida aberta, continua.
  const jogar = async () => {
    try {
      const r = await api.post(`/jogos/${id}/sessoes`);
      navegar(`/partida/${r.id_sessao}`);
    } catch (e) {
      setErro(e);
    }
  };

  if (!j) return erro ? <Erro erro={erro} /> : <p className="muted">Carregando…</p>;

  return (
    <>
      <p><button className="link" onClick={() => navegar(-1)}>← Voltar</button></p>
      <Erro erro={erro} />
      <div className="page-head">
        <div>
          <p className="eyebrow">{j.disciplina}</p>
          <h1>{j.titulo}</h1>
          <p className="pills">
            <PillDificuldade valor={j.dificuldade} /> <span className="code-tag">🔑 {j.codigo_acesso}</span>{' '}
            <span className="muted">Prof. {j.autor_nome}</span>
          </p>
        </div>
        <button className="btn" onClick={jogar}>
          {j.sessao_aberta ? '▶ Continuar partida' : j.minhas_sessoes.length ? '↻ Jogar de novo' : '▶ Jogar'}
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

      <section className="card">
        <h3>Ranking</h3>
        <Ranking linhas={j.ranking} destacar={usuario?.id_usuario} />
      </section>

      <section className="card">
        <h3>Minhas partidas</h3>
        {j.minhas_sessoes.length === 0 ? (
          <p className="muted">Você ainda não terminou nenhuma partida desta cruzada.</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr><th>Data</th><th>Versão</th><th>Tempo</th><th>Conferências</th><th>Dicas</th><th>Certas</th><th>Pontos</th></tr>
              </thead>
              <tbody>
                {j.minhas_sessoes.map((s) => (
                  <tr key={s.id_sessao}>
                    <td>{formatarData(s.fim)}</td>
                    <td>v{s.numero_versao}</td>
                    <td>{formatarTempo(s.tempo)}</td>
                    <td>{s.tentativas}</td>
                    <td>{s.dicas}</td>
                    <td>{s.acertos}/{s.qtd_palavras}</td>
                    <td><strong>{s.pontuacao}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
