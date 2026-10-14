// Login simulado: a autenticacao real sera feita pelo Ludica.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao, inicioDoPapel } from '../Sessao.jsx';
import { Erro } from '../componentes/comuns.jsx';

const GRUPOS = [
  ['professor', 'Professores'],
  ['aluno', 'Alunos'],
  ['administrador', 'Administradores']
];

export default function Login() {
  const { usuario, entrar, entrarLudica } = useSessao();
  const [usuarios, setUsuarios] = useState([]);
  const [escolhido, setEscolhido] = useState('');
  const [payload, setPayload] = useState({
    id: 1003,
    usertag: 'prof.novo',
    nome: 'Professor Novo',
    email: 'prof.novo@cefet-rj.br',
    papel: 'professor'
  });
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get('/auth/usuarios').then((lista) => {
      setUsuarios(lista);
      if (lista[0]) setEscolhido(String(lista[0].id_usuario));
    }).catch(setErro);
  }, []);

  if (usuario) return <Navigate to={inicioDoPapel(usuario.papel)} replace />;

  const tentar = (fn) => async (e) => {
    e.preventDefault();
    setErro(null);
    try {
      await fn();
    } catch (err) {
      setErro(err);
    }
  };

  return (
    <div className="auth-grid">
      <section className="card">
        <h1>Entrar</h1>
        <p className="muted">
          A autenticação será feita pelo <strong>Lúdica</strong>. Enquanto a integração não existe,
          escolha um usuário já sincronizado para “entrar como”.
        </p>
        <Erro erro={erro} />
        <form className="stack" onSubmit={tentar(() => entrar(Number(escolhido)))}>
          <label>
            Entrar como
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} required>
              {GRUPOS.map(([papel, rotulo]) => (
                <optgroup key={papel} label={rotulo}>
                  {usuarios
                    .filter((u) => u.papel === papel)
                    .map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        @{u.usertag} — {u.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="btn">Entrar</button>
        </form>
      </section>

      <section className="card card-muted">
        <h2>Simular payload do Lúdica</h2>
        <p className="muted">
          O Lúdica envia <code>id</code>, <code>usertag</code>, <code>email</code> e <code>papel</code>.
          Aqui o usuário é criado/atualizado e já entra.
        </p>
        <form className="stack" onSubmit={tentar(() => entrarLudica(payload))}>
          {[
            ['id', 'id (Lúdica)', 'number'],
            ['usertag', 'usertag', 'text'],
            ['nome', 'nome', 'text'],
            ['email', 'email', 'email']
          ].map(([campo, rotulo, tipo]) => (
            <label key={campo}>
              {rotulo}
              <input
                type={tipo}
                value={payload[campo]}
                required={campo !== 'nome'}
                onChange={(e) => setPayload({ ...payload, [campo]: e.target.value })}
              />
            </label>
          ))}
          <label>
            papel
            <select value={payload.papel} onChange={(e) => setPayload({ ...payload, papel: e.target.value })}>
              <option value="professor">professor</option>
              <option value="aluno">aluno</option>
              <option value="administrador">administrador</option>
            </select>
          </label>
          <button className="btn btn-ghost">Sincronizar e entrar</button>
        </form>
      </section>
    </div>
  );
}
