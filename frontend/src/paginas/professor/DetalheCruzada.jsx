import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import {
  Aviso, Erro, Grade, ListaDicas, PillDificuldade, PillStatus, Ranking, formatarData, formatarTempo
} from '../../componentes/comuns.jsx';

export default function DetalheCruzada() {
  const { id } = useParams();
  const { state } = useLocation();
  const navegar = useNavigate();
  const [c, setC] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get(`/professor/cruzadas/${id}`).then(setC).catch(setErro);
  }, [id]);

  const excluir = async () => {
    if (!confirm('Excluir este jogo e todas as suas versões?')) return;
    try {
      await api.del(`/professor/cruzadas/${id}`);
      navegar('/professor');
    } catch (e) {
      setErro(e);
    }
  };

  if (!c) return erro ? <Erro erro={erro} /> : <p className="muted">Carregando…</p>;

  const ordenadas = [...c.palavras].sort((a, b) => a.numero - b.numero);
  return (
    <>
      <Aviso>{state?.aviso}</Aviso>
      <Erro erro={erro} />

      <div className="page-head">
        <div>
          <p className="eyebrow">{c.disciplina}</p>
          <h1>{c.titulo}</h1>
          <p className="pills">
            <PillStatus valor={c.status} /> <PillDificuldade valor={c.dificuldade} />{' '}
            <span className="code-tag">🔑 {c.codigo_acesso}</span>{' '}
            <span className="muted">v{c.versao_atual?.numero_versao} · {c.palavras.length} palavras</span>
          </p>
        </div>
        <div className="acoes">
          <Link className="btn btn-ghost" to={`/professor/cruzadas/${id}/editar`}>Editar</Link>
          <button className="btn btn-danger" onClick={excluir}>Excluir</button>
        </div>
      </div>
      {c.descricao && <p>{c.descricao}</p>}

      <div className="detalhe-grid">
        <section className="card">
          <h2>Grade gerada</h2>
          <Grade matriz={c.matriz} numeros={c.palavras} />
          <p className="muted small">{c.versao_atual?.linhas} × {c.versao_atual?.colunas} — gabarito visível só para você.</p>
        </section>
        <section className="card">
          <ListaDicas
            mostrarResposta
            horizontais={ordenadas.filter((p) => p.direcao === 'horizontal')}
            verticais={ordenadas.filter((p) => p.direcao === 'vertical')}
          />
        </section>
      </div>

      <section className="card">
        <h3>Ranking</h3>
        <Ranking linhas={c.ranking} />
      </section>

      <section className="card">
        <h3>Partidas dos alunos</h3>
        {c.partidas.length === 0 ? (
          <p className="muted">Nenhuma partida terminada ainda.</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr><th>Aluno</th><th>Data</th><th>Versão</th><th>Certas</th><th>Conferências</th><th>Dicas</th><th>Erros</th><th>Tempo</th><th>Pontos</th></tr>
              </thead>
              <tbody>
                {c.partidas.map((p) => (
                  <tr key={p.id_sessao}>
                    <td>{p.nome} <span className="muted">@{p.usertag}</span></td>
                    <td>{formatarData(p.fim)}</td>
                    <td>v{p.numero_versao}</td>
                    <td>{p.acertos}/{p.qtd_palavras}</td>
                    <td>{p.tentativas}</td>
                    <td>{p.dicas}</td>
                    <td>{p.erros}</td>
                    <td>{formatarTempo(p.tempo)}</td>
                    <td><strong>{p.pontuacao}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card versoes">
        <h3>Histórico de versões (RN09)</h3>
        <table className="tabela">
          <thead>
            <tr><th>Versão</th><th>Criada em</th><th>Palavras</th><th>Partidas</th></tr>
          </thead>
          <tbody>
            {c.versoes.map((v) => (
              <tr key={v.id_versao}>
                <td>v{v.numero_versao}</td>
                <td>{formatarData(v.data_criacao)}</td>
                <td>{v.qtd_palavras}</td>
                <td>{v.sessoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
