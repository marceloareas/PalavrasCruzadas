# Front-end — Cruzadinha Digital

React 18 + Vite + React Router. No Docker, o build é servido pelo nginx, que
repassa `/api` para a API (`nginx.conf`).

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173 (API em localhost:3000)
npm run build      # gera dist/
```

A API precisa estar no ar (`docker compose up` na raiz, ou `npm run dev` em `backend/`).
Para usar outra API: `API_URL=http://host:3000 npm run dev`.

## Organização

```
src/main.jsx              rotas (cada uma protegida por papel)
src/Sessao.jsx            usuário logado, regras da API, <Protegida>
src/api.js                fetch com cookie + ErroApi
src/estilo.css            tema
src/componentes/          Layout (topo), comuns (Grade, Ranking, Erro, …)
src/paginas/Login.jsx
src/paginas/professor/    Painel, FormCruzada, DetalheCruzada, SolicitarDisciplina
src/paginas/aluno/        BuscarJogos, DetalheJogo, Jogar
src/paginas/admin/        Disciplinas, Solicitacoes
```

Detalhes das telas e da tela de jogo: [../docs/frontend.md](../docs/frontend.md).
