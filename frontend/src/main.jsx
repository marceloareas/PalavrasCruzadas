import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './estilo.css';
import { SessaoProvider, Protegida, useSessao, inicioDoPapel } from './Sessao.jsx';
import Layout from './componentes/Layout.jsx';
import Login from './paginas/Login.jsx';
import Painel from './paginas/professor/Painel.jsx';
import FormCruzada from './paginas/professor/FormCruzada.jsx';
import DetalheCruzada from './paginas/professor/DetalheCruzada.jsx';
import SolicitarDisciplina from './paginas/professor/SolicitarDisciplina.jsx';
import Disciplinas from './paginas/admin/Disciplinas.jsx';
import Solicitacoes from './paginas/admin/Solicitacoes.jsx';
import BuscarJogos from './paginas/aluno/BuscarJogos.jsx';
import DetalheJogo from './paginas/aluno/DetalheJogo.jsx';

function Inicio() {
  const { usuario } = useSessao();
  if (usuario === undefined) return null;
  return <Navigate to={usuario ? inicioDoPapel(usuario.papel) : '/login'} replace />;
}

const so = (papeis, elemento) => <Protegida papeis={papeis}>{elemento}</Protegida>;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessaoProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="login" element={<Login />} />

            <Route path="professor" element={so(['professor'], <Painel />)} />
            <Route path="professor/nova" element={so(['professor'], <FormCruzada />)} />
            <Route path="professor/cruzadas/:id" element={so(['professor'], <DetalheCruzada />)} />
            <Route path="professor/cruzadas/:id/editar" element={so(['professor'], <FormCruzada />)} />
            <Route path="professor/solicitacoes" element={so(['professor'], <SolicitarDisciplina />)} />

            <Route path="admin/disciplinas" element={so(['administrador'], <Disciplinas />)} />
            <Route path="admin/solicitacoes" element={so(['administrador'], <Solicitacoes />)} />

            <Route path="jogos" element={so(['aluno'], <BuscarJogos />)} />
            <Route path="jogos/:id" element={so(['aluno'], <DetalheJogo />)} />

            <Route path="*" element={<Inicio />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessaoProvider>
  </React.StrictMode>
);
