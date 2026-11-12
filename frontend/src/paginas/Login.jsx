// Tela de entrada. A Cruzadinha so e acessada pelo Ludica, que abre o jogo com
// um POST de formulario direto no backend (POST /api/auth/ludica); ele volta
// para ca ja logado ou com ?erro=<motivo>. Em desenvolvimento aparecem os
// atalhos de teste.
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao, inicioDoPapel } from '../Sessao.jsx';
import { Erro } from '../componentes/comuns.jsx';

const MOTIVOS = {
  token: 'Acesso inválido ou expirado. Entre pelo Lúdica e abra a Cruzadinha de novo.',
  perfil: 'Seu tipo de usuário no Lúdica não tem acesso à Cruzadinha.',
  email: 'Este email já está associado a outra gamertag. Procure o suporte.',
  dados: 'Os dados de acesso vieram incompletos. Entre pelo Lúdica e abra a Cruzadinha de novo.'
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

      {modo?.login_dev && <AtalhosDev urlRetorno={modo.url_retorno_dev} />}
    </div>
  );
}

// ---- So em desenvolvimento (LOGIN_DEV) --------------------------------------
const GRUPOS = [
  ['professor', 'Professores'],
  ['aluno', 'Alunos'],
  ['administrador', 'Administradores']
];

// Faz o mesmo que o navegador faz quando o Ludica abre o jogo: um POST de
// formulario (nao fetch) para a rota de entrada.
function postarFormulario(acao, campos) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = acao;
  for (const [nome, valor] of Object.entries(campos)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = nome;
    input.value = valor;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

function AtalhosDev({ urlRetorno }) {
  const { entrar } = useSessao();
  const [usuarios, setUsuarios] = useState([]);
  const [escolhido, setEscolhido] = useState('');
  const [link, setLink] = useState({
    gamertag: 'aluno.novo',
    email: 'aluno.novo@aluno.cefet-rj.br',
    tipo_usuario: 'aluno',
    url_retorno: urlRetorno ?? ''
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

  // Gera os mesmos campos que o Ludica mandaria e faz o POST (fluxo real).
  const abrirLink = async () => {
    const { acao, campos } = await api.post('/auth/dev/entrada-ludica', link);
    postarFormulario(acao, campos);
  };

  return (
    <section className="card card-muted">
      <h2>Atalhos de desenvolvimento</h2>
      <p className="muted">Só aparecem com <code>LOGIN_DEV=true</code>; em produção ficam desligados.</p>
      <Erro erro={erro} />

      <form className="stack" onSubmit={tentar(abrirLink)}>
        <h3>Simular entrada do Lúdica</h3>
        {[
          ['gamertag', 'gamertag', 'text'],
          ['email', 'email', 'email'],
          ['url_retorno', 'url_retorno (para onde vai o resultado)', 'url']
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
          tipo_usuario
          <select value={link.tipo_usuario} onChange={(e) => setLink({ ...link, tipo_usuario: e.target.value })}>
            <option value="aluno">aluno</option>
            <option value="professor">professor</option>
            <option value="administrador">administrador (partida de teste, joga como aluno)</option>
          </select>
        </label>
        <button className="btn">Entrar como se viesse do Lúdica</button>
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
