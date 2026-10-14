// Criar / editar cruzada. O professor informa so respostas e dicas; a grade
// e gerada pelo sistema ao salvar (RN06/RN14).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useSessao } from '../../Sessao.jsx';
import { Erro, OPCOES_DIFICULDADE, OPCOES_STATUS } from '../../componentes/comuns.jsx';

const vazia = () => ({ resposta: '', dica: '' });

export default function FormCruzada() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const { regras } = useSessao();
  const min = regras?.minPalavras ?? 5;
  const max = regras?.maxPalavras ?? 15;

  const [disciplinas, setDisciplinas] = useState([]);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    id_disciplina: '',
    dificuldade: 'facil',
    status: 'rascunho'
  });
  const [palavras, setPalavras] = useState(() => Array.from({ length: 5 }, vazia));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(!editando);

  useEffect(() => {
    (async () => {
      try {
        const lista = await api.get('/disciplinas');
        if (!editando) {
          setDisciplinas(lista);
          return;
        }
        const c = await api.get(`/professor/cruzadas/${id}`);
        // Mantem a disciplina atual na lista mesmo que tenha sido desativada.
        setDisciplinas(
          lista.some((d) => d.id_disciplina === c.id_disciplina)
            ? lista
            : [...lista, { id_disciplina: c.id_disciplina, nome: `${c.disciplina} (desativada)` }]
        );
        setForm({
          titulo: c.titulo,
          descricao: c.descricao ?? '',
          id_disciplina: String(c.id_disciplina),
          dificuldade: c.dificuldade,
          status: c.status
        });
        setPalavras(
          [...c.palavras].sort((a, b) => a.indice - b.indice).map(({ resposta, dica }) => ({ resposta, dica }))
        );
        setCarregado(true);
      } catch (e) {
        setErro(e);
      }
    })();
  }, [id, editando]);

  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm({ ...form, [nome]: e.target.value })
  });
  const alterarPalavra = (i, nome, valor) =>
    setPalavras(palavras.map((p, j) => (j === i ? { ...p, [nome]: valor } : p)));

  const salvar = async (e) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const corpo = { ...form, palavras };
      if (editando) {
        const r = await api.put(`/professor/cruzadas/${id}`, corpo);
        navegar(`/professor/cruzadas/${id}`, {
          state: {
            aviso: r.novaVersao
              ? `Nova versão v${r.numeroVersao} gerada. As partidas da versão anterior foram preservadas (RN09).`
              : 'Dados atualizados (as palavras não mudaram, então não foi criada versão nova).'
          }
        });
      } else {
        const r = await api.post('/professor/cruzadas', corpo);
        navegar(`/professor/cruzadas/${r.idCruzada}`, {
          state: { aviso: 'Jogo criado! A grade foi gerada automaticamente a partir das palavras.' }
        });
      }
    } catch (err) {
      setErro(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  };

  if (!carregado) return erro ? <Erro erro={erro} /> : <p className="muted">Carregando…</p>;

  const preenchidas = palavras.filter((p) => p.resposta.trim()).length;
  return (
    <form className="stack" onSubmit={salvar}>
      <div className="page-head">
        <div>
          <p className="eyebrow">{editando ? 'Editar jogo' : 'Novo jogo'}</p>
          <h1>{editando ? form.titulo : 'Criar palavra cruzada'}</h1>
        </div>
      </div>

      <Erro erro={erro} />

      <section className="card stack">
        <label>
          Título
          <input {...campo('titulo')} maxLength={150} required />
        </label>
        <label>
          Descrição
          <textarea {...campo('descricao')} rows={2} />
        </label>
        <div className="grid-3">
          <label>
            Disciplina
            <select {...campo('id_disciplina')} required>
              <option value="">Escolha…</option>
              {disciplinas.map((d) => (
                <option key={d.id_disciplina} value={d.id_disciplina}>{d.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Dificuldade
            <select {...campo('dificuldade')}>
              {OPCOES_DIFICULDADE.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label>
            Status
            <select {...campo('status')}>
              {OPCOES_STATUS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">
          Não achou a disciplina? <Link to="/professor/solicitacoes">Solicite ao administrador</Link>.
          Só jogos <strong>publicados</strong> aparecem para os alunos.
        </p>
      </section>

      <section className="card stack">
        <div className="palavras-head">
          <h2>Palavras e dicas</h2>
          <span className={`badge-count ${preenchidas < min || preenchidas > max ? 'fora' : ''}`}>
            {preenchidas} / {max} (mínimo {min})
          </span>
        </div>
        <p className="muted small">
          Cadastre só a resposta e a dica. Ao salvar, o sistema monta a grade sozinho cruzando as palavras.
        </p>

        {palavras.map((p, i) => (
          <div key={i} className="palavra-row">
            <span className="palavra-n">{i + 1}</span>
            <input
              aria-label={`Resposta ${i + 1}`}
              placeholder="RESPOSTA"
              className="input-resposta"
              value={p.resposta}
              maxLength={40}
              onChange={(e) => alterarPalavra(i, 'resposta', e.target.value)}
            />
            <input
              aria-label={`Dica ${i + 1}`}
              placeholder="Dica"
              value={p.dica}
              maxLength={regras?.maxDica ?? 300}
              onChange={(e) => alterarPalavra(i, 'dica', e.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Remover"
              disabled={palavras.length <= 1}
              onClick={() => setPalavras(palavras.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-ghost"
          disabled={palavras.length >= max}
          onClick={() => setPalavras([...palavras, vazia()])}
        >
          + Adicionar palavra
        </button>
      </section>

      <div className="form-actions">
        <button className="btn" disabled={salvando}>
          {salvando ? 'Gerando grade…' : editando ? 'Salvar alterações' : 'Salvar e gerar grade'}
        </button>
        <Link className="btn btn-ghost" to={editando ? `/professor/cruzadas/${id}` : '/professor'}>Cancelar</Link>
      </div>
    </form>
  );
}
