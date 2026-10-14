# Front-end (React)

React 18 + Vite + React Router 6, sem biblioteca de componentes. O estilo é um
CSS único ([`estilo.css`](../frontend/src/estilo.css)) com a paleta do
protótipo do Stitch (roxo `#6d4cf0`).

## Telas por perfil

| Rota | Perfil | Tela | Arquivo |
|---|---|---|---|
| `/login` | todos | Entrar como / simular payload do Lúdica | `paginas/Login.jsx` |
| `/professor` | professor | Painel: estatísticas e "Meus jogos" | `paginas/professor/Painel.jsx` |
| `/professor/nova` | professor | Criar jogo: dados + lista de resposta/dica (5–15) | `paginas/professor/FormCruzada.jsx` |
| `/professor/cruzadas/:id` | professor (autor) | Grade gerada com gabarito, dicas, ranking, partidas, versões | `paginas/professor/DetalheCruzada.jsx` |
| `/professor/cruzadas/:id/editar` | professor (autor) | Mesmo formulário, preenchido | `paginas/professor/FormCruzada.jsx` |
| `/professor/solicitacoes` | professor | Pedir disciplina nova e acompanhar as respostas | `paginas/professor/SolicitarDisciplina.jsx` |
| `/jogos` | aluno | Buscar jogos (texto, código, disciplina, dificuldade) | `paginas/aluno/BuscarJogos.jsx` |
| `/jogos/:id` | aluno | Tabuleiro vazio, dicas, ranking, minhas partidas, botão Jogar | `paginas/aluno/DetalheJogo.jsx` |
| `/partida/:id` | aluno (dono) | Jogar / resultado | `paginas/aluno/Jogar.jsx` |
| `/admin/disciplinas` | administrador | Manter disciplinas | `paginas/admin/Disciplinas.jsx` |
| `/admin/solicitacoes` | administrador | Aprovar/recusar solicitações | `paginas/admin/Solicitacoes.jsx` |

`/` manda cada perfil para a sua tela inicial (`inicioDoPapel` em `Sessao.jsx`).

## Peças compartilhadas

| Arquivo | O que tem |
|---|---|
| `main.jsx` | Todas as rotas; cada uma é envolvida por `<Protegida papeis={[...]}>` |
| `Sessao.jsx` | Contexto com `usuario` (de `/auth/eu`), `regras` (de `/regras`), `entrar`, `entrarLudica`, `sair`; `<Protegida>` redireciona quem não tem o papel |
| `api.js` | `api.get/post/put/del` sobre `fetch` (com cookie), `ErroApi` com `message` + `erros`, e `qs()` para query string |
| `componentes/Layout.jsx` | Barra do topo com o menu do perfil, o papel, o usuário e Sair |
| `componentes/comuns.jsx` | `Erro`, `Aviso`, `Grade` (matriz + números), `ListaDicas`, `Ranking`, pílulas de dificuldade/status, `formatarTempo`, `formatarData` |

## Padrões usados nas páginas

- Os dados são carregados num `useEffect` com `api.get(...)`; o erro vai para o
  estado e é mostrado com `<Erro erro={erro} />`.
- Erros de validação (422) aparecem como lista no topo do formulário, com as
  mensagens que vêm da API. O front não duplica as regras: ele só usa
  `/api/regras` para o contador "7 / 15 (mínimo 5)".
- Mensagens de sucesso depois de navegar vão pelo `state` do React Router
  (ex.: "Jogo criado! A grade foi gerada…").
- Os filtros da busca do aluno ficam na **URL** (`/jogos?texto=redes`), então
  voltar do detalhe não perde a busca.

## Tela de jogo (`Jogar.jsx`)

- `Tabuleiro`: cada casa é um `<input>`. O estado é `letras` (`"linha,coluna" → letra`)
  e `ativa` (casa + palavra selecionadas).
- As **letras são tratadas no `onKeyDown`**, não só no `onChange`. Quando a casa
  já tem a mesma letra (vinda da palavra que cruza), o valor não muda e o React
  não dispara `onChange`, então o cursor não andaria. O `onChange` fica como
  reserva para teclado de celular.
- A palavra ativa só muda por **clique** (casa ou dica) ou pelas setas. O foco
  programático (`focus()`) não altera a seleção. Isso evita usar estado antigo
  dentro do `onFocus`.
- **💡 Revelar letra** (RN20) chama `/sessoes/:id/dica` com o que está na tela para a palavra selecionada. A casa revelada entra no conjunto `reveladas`: fica amarela e `readOnly`, digitar só pula para a próxima e o Backspace não a apaga.
- Ao conferir, cada palavra é montada a partir das casas dela
  (`{ indice: "TEXTO" }`) e enviada para `/sessoes/:id/conferir`.
- `Cronometro` é só visual; o tempo que vale é o do servidor.
- Com a partida encerrada, a mesma rota mostra `Resultado` (placar, conta dos
  pontos, gabarito e respostas).

## Rodar só o front

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — usa a API em localhost:3000
```

Para apontar para outra API: `API_URL=http://outro:3000 npm run dev`.
`npm run build` gera `dist/`, que o `Dockerfile` copia para o nginx.
