// Usuario logado + limites de negocio (vindos de /api/regras).
import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api.js';

const SessaoContexto = createContext(null);

export function SessaoProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = carregando
  const [regras, setRegras] = useState(null);

  useEffect(() => {
    api.get('/auth/eu').then(setUsuario).catch(() => setUsuario(null));
    api.get('/regras').then(setRegras).catch(() => {});
  }, []);

  const entrar = async (idUsuario) => setUsuario(await api.post('/auth/entrar', { id_usuario: idUsuario }));
  const entrarLudica = async (payload) => setUsuario(await api.post('/auth/ludica', payload));
  const sair = async () => {
    await api.post('/auth/sair');
    setUsuario(null);
  };

  return (
    <SessaoContexto.Provider value={{ usuario, regras, entrar, entrarLudica, sair }}>
      {children}
    </SessaoContexto.Provider>
  );
}

export const useSessao = () => useContext(SessaoContexto);

// Pagina inicial de cada papel.
export const inicioDoPapel = (papel) =>
  ({ professor: '/professor', aluno: '/jogos', administrador: '/admin/disciplinas' })[papel] || '/login';

// Bloqueia a rota para quem nao tem um dos papeis.
export function Protegida({ papeis, children }) {
  const { usuario } = useSessao();
  if (usuario === undefined) return <p className="muted">Carregando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (papeis && !papeis.includes(usuario.papel)) return <Navigate to={inicioDoPapel(usuario.papel)} replace />;
  return children;
}
