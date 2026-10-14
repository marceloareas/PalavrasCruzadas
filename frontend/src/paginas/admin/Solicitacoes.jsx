// RN16 - Administrador aprova (criando a disciplina) ou recusa solicitacoes.
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Aviso, Erro, formatarData } from '../../componentes/comuns.jsx';

function Pendente({ s, aoResponder }) {
  const [form, setForm] = useState({ nome: s.nome, codigo: s.codigo_sugerido ?? '', resposta: '' });
  const campo = (n) => ({ value: form[n], onChange: (e) => setForm({ ...form, [n]: e.target.value }) });

  return (
    <article className="card stack">
      <div>
        <strong>{s.nome}</strong>{' '}
        <span className="muted">
          — pedido por {s.professor_nome} (@{s.professor_usertag}) em {formatarData(s.data_solicitacao)}
        </span>
        {s.justificativa && <p className="citacao">“{s.justificativa}”</p>}
      </div>
      <div className="grid-3">
        <label>Nome final<input {...campo('nome')} /></label>
        <label>Código<input {...campo('codigo')} placeholder="obrigatório para aprovar" /></label>
        <label>Mensagem ao professor<input {...campo('resposta')} /></label>
      </div>
      <div className="acoes">
        <button className="btn btn-sm" onClick={() => aoResponder(s, { aprovar: true, ...form })}>Aprovar e criar</button>
        <button className="btn btn-ghost btn-sm perigo" onClick={() => aoResponder(s, { aprovar: false, resposta: form.resposta })}>
          Recusar
        </button>
      </div>
    </article>
  );
}

export default function Solicitacoes() {
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = () => api.get('/solicitacoes').then(setLista).catch(setErro);
  useEffect(() => {
    carregar();
  }, []);

  const responder = async (s, corpo) => {
    setErro(null);
    setAviso(null);
    try {
      const r = await api.post(`/solicitacoes/${s.id_solicitacao}/responder`, corpo);
      setAviso(r.status === 'aprovada' ? `Disciplina “${corpo.nome}” criada.` : `Solicitação “${s.nome}” recusada.`);
      carregar();
    } catch (e) {
      setErro(e);
    }
  };

  const pendentes = lista.filter((s) => s.status === 'pendente');
  const respondidas = lista.filter((s) => s.status !== 'pendente');

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Solicitações de disciplina</h1>
        </div>
      </div>

      <Aviso>{aviso}</Aviso>
      <Erro erro={erro} />

      <h2>Pendentes ({pendentes.length})</h2>
      {pendentes.length === 0 && <p className="muted">Nenhuma solicitação aguardando resposta.</p>}
      {pendentes.map((s) => <Pendente key={s.id_solicitacao} s={s} aoResponder={responder} />)}

      {respondidas.length > 0 && (
        <>
          <h2>Respondidas</h2>
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr><th>Disciplina</th><th>Professor</th><th>Status</th><th>Respondida por</th><th>Mensagem</th></tr>
              </thead>
              <tbody>
                {respondidas.map((s) => (
                  <tr key={s.id_solicitacao}>
                    <td>{s.nome}</td>
                    <td>@{s.professor_usertag}</td>
                    <td><span className={`pill pill-sol-${s.status}`}>{s.status}</span></td>
                    <td>@{s.admin_usertag}</td>
                    <td>{s.resposta_admin || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
