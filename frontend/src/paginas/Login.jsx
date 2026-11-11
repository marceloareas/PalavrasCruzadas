// Tela de entrada. A Cruzadinha so e acessada pelo link do Ludica, que cai
// direto no backend (GET /api/auth/ludica) e volta para ca ja logado ou com
// ?erro=<motivo>. Em desenvolvimento aparecem os atalhos de teste.
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao, inicioDoPapel } from '../Sessao.jsx';
import { Erro } from '../componentes/comuns.jsx';

const MOTIVOS = {
  token: 'Link inválido ou expirado. Volte ao Lúdica e abra a Cruzadinha de novo.',
  perfil: 'Seu perfil no Lúdica não tem acesso à Cruzadinha.',
  email: 'Este email já está associado a outra gamertag. Procure o suporte.',
  dados: 'O link de acesso está incompleto. Volte ao Lúdica e abra a Cruzadinha de novo.'
};

export default function Login() {
  const { usuario } = useSessao();
  const [params] = useSearchParams();
  const [modo, setModo] = useState(null);

  useEffect(() => {
    api.get('/auth/modo').then(setModo).catch(() => setModo({ login_dev: false }));
  }, []);

  if (usuario) return <Navigate to={inicioDoPapel(usuario.papel)} replace />;

  const motivo = params.get('erro');

  return (
    <div className={modo?.login_dev ? 'auth-grid' : 'stack'}>
      <section className="card">
        <h1>Acesse pelo Lúdica</h1>
        {motivo && (
          <div className="alert alert-erro" role="alert">
            <strong>Acesso negado.</strong> {MOTIVOS[motivo] ?? MOTIVOS.dados}
          </div>
        )}
        <p className="muted">
          A Cruzadinha Digital faz parte do <strong>Lúdica</strong>. Entre na sua conta do Lúdica e
          abra a Cruzadinha por lá: você chega aqui já identificado e suas pontuações voltam para o
          seu perfil.
        </p>
        {modo?.url_ludica && (
          <a className="btn" href={modo.url_ludica}>
            Ir para o Lúdica
          </a>
        )}
      </section>

      {modo?.login_dev && <AtalhosDev perfis={modo.perfis} />}
    </div>
  );
}

// ---- So em desenvolvimento (LOGIN_DEV) --------------------------------------
const GRUPOS = [
  ['professor', 'Professores'],
  ['aluno', 'Alunos'],
  ['administrador', 'Administradores']
];

function AtalhosDev({ perfis }) {
  const { entrar } = useSessao();
  const [usuarios, setUsuarios] = useState([]);
  const [escolhido, setEscolhido] = useState('');
  const [link, setLink] = useState({
    gamertag: 'aluno.novo',
    email: 'aluno.novo@aluno.cefet-rj.br',
    perfil: perfis?.aluno ?? '2'
  });
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get('/auth/usuarios').then((lista) => {
      setUsuarios(lista);
      if (lista[0]) setEscolhido(String(lista[0].id_usuario));
    }).catch(setErro);
  }, []);

  const tentar = (fn) => async (e) => {
    e.preventDefault();
    setErro(null);
    try {
      await fn();
    } catch (err) {
      setErro(err);
    }
  };

  // Gera o mesmo link que o Ludica geraria e navega por ele (fluxo real).
  const abrirLink = async () => {
    const { url } = await api.post('/auth/dev/link-ludica', link);
    window.location.assign(url);
  };

  return (
    <section className="card card-muted">
      <h2>Atalhos de desenvolvimento</h2>
      <p className="muted">Só aparecem com <code>LOGIN_DEV=true</code>; em produção ficam desligados.</p>
      <Erro erro={erro} />

      <form className="stack" onSubmit={tentar(abrirLink)}>
        <h3>Simular link do Lúdica</h3>
        {[
          ['gamertag', 'gamertag', 'text'],
          ['email', 'email', 'email']
        ].map(([campo, rotulo, tipo]) => (
          <label key={campo}>
            {rotulo}
            <input
              type={tipo}
              value={link[campo]}
              required
              onChange={(e) => setLink({ ...link, [campo]: e.target.value })}
            />
          </label>
        ))}
        <label>
          perfil
          <select value={link.perfil} onChange={(e) => setLink({ ...link, perfil: e.target.value })}>
            <option value={perfis?.professor ?? '1'}>{perfis?.professor ?? '1'} — professor</option>
            <option value={perfis?.aluno ?? '2'}>{perfis?.aluno ?? '2'} — aluno</option>
          </select>
        </label>
        <button className="btn">Abrir link</button>
      </form>

      <form className="stack" onSubmit={tentar(() => entrar(Number(escolhido)))}>
        <h3>Entrar como</h3>
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
        <button className="btn btn-ghost">Entrar</button>
      </form>
    </section>
  );
}
