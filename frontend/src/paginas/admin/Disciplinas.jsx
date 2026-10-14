// Manter Disciplina (perfil administrador).
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Aviso, Erro } from '../../componentes/comuns.jsx';

function LinhaDisciplina({ d, aoMudar, aoErro }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nome: d.nome, codigo: d.codigo });

  const executar = async (fn, msg) => {
    try {
      await fn();
      aoMudar(msg);
    } catch (e) {
      aoErro(e);
    }
  };

  const salvar = () =>
    executar(async () => {
      await api.put(`/disciplinas/${d.id_disciplina}`, form);
      setEditando(false);
    }, `Disciplina “${form.nome}” atualizada.`);

  const alternarAtiva = () =>
    executar(
      () => api.put(`/disciplinas/${d.id_disciplina}`, { nome: d.nome, codigo: d.codigo, ativa: !d.ativa }),
      `Disciplina “${d.nome}” ${d.ativa ? 'desativada' : 'reativada'}.`
    );

  const excluir = async () => {
    if (!confirm(`Excluir “${d.nome}”?`)) return;
    try {
      const r = await api.del(`/disciplinas/${d.id_disciplina}`);
      aoMudar(
        r.resultado === 'desativada'
          ? `“${d.nome}” tem ${r.total_cruzadas} jogo(s), então foi desativada em vez de excluída.`
          : `“${d.nome}” excluída.`
      );
    } catch (e) {
      aoErro(e);
    }
  };

  if (editando) {
    return (
      <tr>
        <td><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></td>
        <td><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} size={8} /></td>
        <td>{d.total_cruzadas}</td>
        <td />
        <td className="acoes">
          <button className="btn btn-sm" onClick={salvar}>Salvar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
        </td>
      </tr>
    );
  }
  return (
    <tr className={d.ativa ? '' : 'inativa'}>
      <td>{d.nome}</td>
      <td><code>{d.codigo}</code></td>
      <td>{d.total_cruzadas}</td>
      <td><span className={`pill ${d.ativa ? 'pill-publicado' : 'pill-arquivado'}`}>{d.ativa ? 'Ativa' : 'Inativa'}</span></td>
      <td className="acoes">
        <button className="btn btn-ghost btn-sm" onClick={() => setEditando(true)}>Editar</button>
        <button className="btn btn-ghost btn-sm" onClick={alternarAtiva}>{d.ativa ? 'Desativar' : 'Reativar'}</button>
        <button className="btn btn-ghost btn-sm perigo" onClick={excluir}>Excluir</button>
      </td>
    </tr>
  );
}

export default function Disciplinas() {
  const [lista, setLista] = useState([]);
  const [nova, setNova] = useState({ nome: '', codigo: '' });
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = () => api.get('/disciplinas?todas=1').then(setLista).catch(setErro);
  useEffect(() => {
    carregar();
  }, []);

  const aoMudar = (msg) => {
    setErro(null);
    setAviso(msg);
    carregar();
  };

  const criar = async (e) => {
    e.preventDefault();
    try {
      await api.post('/disciplinas', nova);
      setNova({ nome: '', codigo: '' });
      aoMudar(`Disciplina “${nova.nome}” criada.`);
    } catch (err) {
      setAviso(null);
      setErro(err);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Manter disciplinas</h1>
        </div>
      </div>

      <Aviso>{aviso}</Aviso>
      <Erro erro={erro} />

      <form className="card form-inline" onSubmit={criar}>
        <label>Nome<input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} required /></label>
        <label>Código<input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} required size={8} /></label>
        <button className="btn">+ Adicionar</button>
      </form>

      <div className="tabela-scroll">
        <table className="tabela">
          <thead>
            <tr><th>Nome</th><th>Código</th><th>Jogos</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((d) => (
              <LinhaDisciplina key={d.id_disciplina} d={d} aoMudar={aoMudar} aoErro={(e) => { setAviso(null); setErro(e); }} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Disciplinas com jogos não são apagadas, só desativadas: os jogos existentes continuam funcionando,
        mas ela some da lista de novos jogos (RN15).
      </p>
    </>
  );
}
