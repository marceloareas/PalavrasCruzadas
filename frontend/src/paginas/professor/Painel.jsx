import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useSessao } from '../../Sessao.jsx';
import { Erro, PillDificuldade, PillStatus, formatarTempo } from '../../componentes/comuns.jsx';

export default function Painel() {
  const { usuario } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get('/professor/cruzadas').then(setDados).catch(setErro);
  }, []);

  const est = dados?.estatisticas;
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Painel do professor</p>
          <h1>Olá, {usuario.nome?.split(' ')[0] || usuario.usertag}!</h1>
        </div>
        <Link className="btn" to="/professor/nova">+ Novo jogo</Link>
      </div>

      <Erro erro={erro} />

      {est && (
        <div className="stat-row">
          <div className="stat"><div className="num">{est.jogos_criados}</div><div className="lbl">Jogos criados</div></div>
          <div className="stat"><div className="num">{est.alunos_ativos}</div><div className="lbl">Alunos que jogaram</div></div>
          <div className="stat">
            <div className="num ok">{est.media_acertos != null ? `${est.media_acertos}%` : '—'}</div>
            <div className="lbl">Média de acertos</div>
          </div>
        </div>
      )}

      {dados && dados.cruzadas.length === 0 && (
        <div className="alert">Você ainda não criou nenhum jogo. Clique em “+ Novo jogo”.</div>
      )}

      {dados?.cruzadas.map((c) => (
        <article key={c.id_cruzada} className="game-card">
          <div className="gc-top">
            <span className="pills">
              <PillStatus valor={c.status} /> <PillDificuldade valor={c.dificuldade} />
            </span>
            <span className="code-tag">🔑 {c.codigo_acesso}</span>
          </div>
          <h3><Link to={`/professor/cruzadas/${c.id_cruzada}`}>{c.titulo}</Link></h3>
          <div className="gc-meta">
            <span>
              {c.disciplina} · {c.qtd_palavras} palavras · v{c.versao_atual} · {c.resolucoes} partida(s)
              {c.tempo_medio != null && ` · média ${formatarTempo(c.tempo_medio)}`}
            </span>
            <Link to={`/professor/cruzadas/${c.id_cruzada}/editar`}>Editar ✎</Link>
          </div>
        </article>
      ))}
    </>
  );
}
