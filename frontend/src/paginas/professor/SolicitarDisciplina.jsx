// RN16 - Professor solicita disciplina nova; o administrador responde.
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Aviso, Erro, formatarData } from '../../componentes/comuns.jsx';

const inicial = { nome: '', codigo_sugerido: '', justificativa: '' };

export default function SolicitarDisciplina() {
  const [form, setForm] = useState(inicial);
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = () => api.get('/solicitacoes').then(setLista).catch(setErro);
  useEffect(() => {
    carregar();
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      await api.post('/solicitacoes', form);
      setForm(inicial);
      setAviso('Solicitação enviada ao administrador.');
      carregar();
    } catch (err) {
      setErro(err);
    }
  };

  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Disciplinas</p>
          <h1>Solicitar nova disciplina</h1>
        </div>
      </div>

      <Aviso>{aviso}</Aviso>
      <Erro erro={erro} />

      <form className="card stack" onSubmit={enviar}>
        <div className="grid-2">
          <label>Nome da disciplina<input {...campo('nome')} maxLength={100} required /></label>
          <label>Código sugerido<input {...campo('codigo_sugerido')} maxLength={20} placeholder="ex.: COMP" /></label>
        </div>
        <label>Justificativa<textarea {...campo('justificativa')} rows={2} /></label>
        <div><button className="btn">Enviar solicitação</button></div>
      </form>

      <h2>Minhas solicitações</h2>
      {lista.length === 0 ? (
        <p className="muted">Nenhuma solicitação ainda.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr><th>Disciplina</th><th>Enviada em</th><th>Status</th><th>Resposta</th></tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id_solicitacao}>
                <td>{s.nome}{s.codigo_sugerido && <span className="muted"> ({s.codigo_sugerido})</span>}</td>
                <td>{formatarData(s.data_solicitacao)}</td>
                <td><span className={`pill pill-sol-${s.status}`}>{s.status}</span></td>
                <td>{s.resposta_admin || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
