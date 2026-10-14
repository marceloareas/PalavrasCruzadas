// Aluno pesquisa jogos publicados por texto, codigo, disciplina e dificuldade.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../../api.js';
import { Erro, OPCOES_DIFICULDADE, PillDificuldade } from '../../componentes/comuns.jsx';

const CAMPOS = ['texto', 'codigo', 'disciplina', 'dificuldade'];

export default function BuscarJogos() {
  // Filtros ficam na URL: da para voltar do detalhe sem perder a busca.
  const [params, setParams] = useSearchParams();
  const filtrosUrl = Object.fromEntries(CAMPOS.map((c) => [c, params.get(c) ?? '']));
  const [form, setForm] = useState(filtrosUrl);
  const [disciplinas, setDisciplinas] = useState([]);
  const [jogos, setJogos] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get('/disciplinas').then(setDisciplinas).catch(setErro);
  }, []);

  const chaveBusca = params.toString();
  useEffect(() => {
    setJogos(null);
    api.get(`/jogos${qs(filtrosUrl)}`).then(setJogos).catch(setErro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveBusca]);

  const buscar = (e) => {
    e.preventDefault();
    setParams(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')));
  };
  const limpar = () => {
    setForm(Object.fromEntries(CAMPOS.map((c) => [c, ''])));
    setParams({});
  };
  const campo = (n) => ({ value: form[n], onChange: (e) => setForm({ ...form, [n]: e.target.value }) });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Área do aluno</p>
          <h1>Buscar jogos</h1>
        </div>
      </div>

      <form className="card filtros" onSubmit={buscar}>
        <label className="filtro-texto">
          Pesquisar
          <input {...campo('texto')} placeholder="título, assunto, disciplina ou professor" />
        </label>
        <label>
          Código de acesso
          <input {...campo('codigo')} placeholder="ex.: BD-12345" />
        </label>
        <label>
          Disciplina
          <select {...campo('disciplina')}>
            <option value="">Todas</option>
            {disciplinas.map((d) => <option key={d.id_disciplina} value={d.id_disciplina}>{d.nome}</option>)}
          </select>
        </label>
        <label>
          Dificuldade
          <select {...campo('dificuldade')}>
            <option value="">Todas</option>
            {OPCOES_DIFICULDADE.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <div className="acoes filtro-botoes">
          <button className="btn">Buscar</button>
          <button type="button" className="btn btn-ghost" onClick={limpar}>Limpar</button>
        </div>
      </form>

      <Erro erro={erro} />

      {jogos === null && !erro && <p className="muted">Buscando…</p>}
      {jogos?.length === 0 && <div className="alert">Nenhum jogo publicado encontrado com esses filtros.</div>}
      {jogos?.length > 0 && <p className="muted">{jogos.length} jogo(s) encontrado(s)</p>}

      <div className="cards-jogos">
        {jogos?.map((j) => (
          <Link key={j.id_cruzada} to={`/jogos/${j.id_cruzada}`} className="game-card game-link">
            <div className="gc-top">
              <span className="eyebrow">{j.disciplina}</span>
              <PillDificuldade valor={j.dificuldade} />
            </div>
            <h3>{j.titulo}</h3>
            {j.descricao && <p className="muted small">{j.descricao}</p>}
            <div className="gc-meta">
              <span>{j.qtd_palavras} palavras · Prof. {j.autor_nome}</span>
              <span>{j.minhas_partidas > 0 ? `você jogou ${j.minhas_partidas}×` : 'novo'}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
