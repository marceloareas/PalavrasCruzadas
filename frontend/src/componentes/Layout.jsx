import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useSessao, inicioDoPapel } from '../Sessao.jsx';

const MENUS = {
  professor: [
    ['/professor', 'Meus jogos', true],
    ['/professor/nova', 'Novo jogo'],
    ['/professor/solicitacoes', 'Solicitar disciplina']
  ],
  aluno: [['/jogos', 'Buscar jogos']],
  administrador: [
    ['/admin/disciplinas', 'Disciplinas'],
    ['/admin/solicitacoes', 'Solicitações']
  ]
};

const ROTULO_PAPEL = { professor: '🎓 Professor', aluno: '👤 Aluno', administrador: '🛠️ Administrador' };

export default function Layout() {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();

  return (
    <>
      <header className="topbar">
        <Link className="brand" to={usuario ? inicioDoPapel(usuario.papel) : '/login'}>
          <span className="brand-mark" aria-hidden="true">
            <span /><span /><span /><span />
          </span>
          <span className="brand-text">
            Cruzadinha Digital
            <small>● Ciência da Computação</small>
          </span>
        </Link>
        {usuario && (
          <nav className="topnav">
            {MENUS[usuario.papel]?.map(([para, rotulo, fim]) => (
              <NavLink key={para} to={para} end={fim} className="navlink">
                {rotulo}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="topuser">
          {usuario && (
            <>
              <span className={`pill pill-${usuario.papel}`}>{ROTULO_PAPEL[usuario.papel]}</span>
              <span className="muted usertag">@{usuario.usertag}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await sair();
                  navegar('/login');
                }}
              >
                Sair
              </button>
            </>
          )}
          <span className="pill pill-ludica">Lúdica</span>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">Projeto acadêmico · CEFET-RJ · Cruzadinha Digital</footer>
    </>
  );
}
