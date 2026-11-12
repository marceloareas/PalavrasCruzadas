# Integração com o Lúdica

A Cruzadinha não tem cadastro nem senha: só se entra pelo Lúdica. Ao terminar
uma partida, o resultado é enviado de volta para o Lúdica.

Seguimos o **padrão do Lúdica para todos os jogos** (Sprint 6), descrito no guia
do repositório deles: `Documents/Integracao/Guia_Integracao_Jogos.md` (branch
`feat/parte-sprint3`). Quem se adapta é o jogo; o Lúdica não precisa de nada
específico da Cruzadinha.

Código: [`services/ludica.js`](../backend/src/services/ludica.js) (hash, entrada, volta),
[`services/envioLudica.js`](../backend/src/services/envioLudica.js) (fila de envio),
[`routes/auth.js`](../backend/src/routes/auth.js) (entrada),
[`app.js`](../backend/src/app.js) (`GET /status`).

## Hash

Toda comunicação é conferida com um SHA-256 (hex minúsculo) de uma seed:

| Sentido | Seed |
|---|---|
| Entrada (Lúdica → Cruzadinha) | `LUD1C@-NOMEJOGO-JOGAR-GAMERTAG-DDMMAAAA` |
| Volta (Cruzadinha → Lúdica) | `LUD1C@-NOMEJOGO-JOGOU-GAMERTAG-DDMMAAAA` |

- **NOMEJOGO**: o título com que o jogo está cadastrado no Lúdica, em maiúsculas,
  sem acento e sem espaço. O nosso é **`CRUZADINHA`** (variável `LUDICA_NOME_JOGO`).
- **GAMERTAG**: exatamente como o Lúdica enviou.
- **DDMMAAAA**: data de hoje no horário de Brasília. O hash só vale no dia.

Exemplo do guia (testado em `test/ludica.test.js`):

```
LUD1C@-PALAVRASCRUZADAS-JOGAR-alice-11112026 → 453b912a88e7156c1f89aea5397d7ff25e97f1ad2ed06ae8cdf751ee40dc58be
LUD1C@-PALAVRASCRUZADAS-JOGOU-alice-11112026 → 61a7821879f642daaf4eadbbac6a5ad5dfaad422f568087f44caca01aeeac1f0
```

Os pontos e o tempo **não** entram no hash: ele prova que a gamertag entrou pelo
Lúdica naquele dia, mas não protege a pontuação.

## Status

Antes de cada partida o Lúdica faz `GET /api/status` e espera `200` em até 3 s.
Respondemos `{ "status": "online", "jogo": "CRUZADINHA" }`, ou `503` se algum banco
estiver fora (aí o Lúdica avisa o aluno que o jogo está fora do ar).

## Entrada

O navegador do jogador chega por um **POST de formulário** em `/api/auth/ludica`:

| Campo | Exemplo | Uso |
|---|---|---|
| `tipo_usuario` | `aluno` | `aluno` → aluno; `professor` → professor; `administrador` (partida de teste) → aluno |
| `email` | `alice@email.com` | gravado no usuário |
| `gamertag` | `alice` | chave do usuário (coluna `usertag`) e parte da seed |
| `hash` | `453b…58be` | conferido com o **nosso** NOMEJOGO e a **nossa** data de hoje |
| `jogo`, `data` | `CRUZADINHA`, `11112026` | informativos; não usamos para conferir o hash |
| `url_retorno` | `http://…/integracao/resultados` | para onde vai o resultado; guardado no usuário |

1. Se o hash bater, o usuário é procurado pela gamertag. Não existe → é criado;
   existe → email, papel e `url_retorno` são atualizados. O **administrador** da
   Cruzadinha é definido só no nosso banco e nunca é rebaixado.
2. A API cria a sessão e redireciona (303) para `/`, que leva à página do papel.
3. Se algo falhar, redireciona para `/login?erro=<motivo>` (`token`, `perfil`,
   `email` ou `dados`), e a tela mostra "Acesso negado".

Acessar a Cruzadinha diretamente leva à tela "Acesse pelo Lúdica".

## Volta: envio do resultado

Quando a partida termina (acertou tudo ou encerrou), a API faz um POST JSON para o
`url_retorno` do aluno, com os 6 campos na ordem do guia:

```json
{ "jogo": "CRUZADINHA", "gamertag": "alice", "data": "11112026",
  "pontos": 772, "tempo_segundos": 180, "hash": "<sha256 da seed JOGOU>" }
```

`pontos` e `tempo_segundos` vão como inteiros. A `data` e o hash são os do momento
do envio.

- A partida é marcada como `ludica_envio = 'pendente'` na mesma transação que grava
  a pontuação (só se o aluno entrou pelo Lúdica, isto é, se temos o `url_retorno`).
  O envio é feito depois do commit, sem atrasar a resposta ao aluno.
- **Lúdica fora do ar ou 5xx:** um laço de reenvio tenta de novo com espera
  crescente (1, 2, 4… até 60 min). Depois de 10 falhas, a partida fica como `'falhou'`.
- **Lúdica recusou (4xx, ex.: hash inválido, jogo não encontrado):** reenviar não
  adianta; a partida vira `'falhou'` na hora, com o motivo em `ludica_erro`.
- Cada partida é reservada por um `UPDATE` atômico antes do envio, então nunca é
  enviada duas vezes (o Lúdica **soma** os pontos).

O log da API mostra cada envio:

```
[ludica] partida 16 enviada ao Lúdica: alice, 772 pts, 180s em "Banco de Dados — Fundamentos" (tentativa 1)
[ludica] partida 17 de alice: envio 1/10 falhou - fetch failed (vai tentar de novo)
```

Para ver o que está pendente ou falhou:

```sql
SELECT id_sessao, ludica_envio, ludica_tentativas, ludica_erro
  FROM sessao_jogo WHERE ludica_envio <> 'enviado';
```

## Configuração

| Variável | Padrão | Para quê |
|---|---|---|
| `LUDICA_NOME_JOGO` | `CRUZADINHA` | NOMEJOGO da seed; tem que bater com o título cadastrado no Lúdica |
| `LUDICA_URL_SITE` | — | página inicial do Lúdica (ex.: `http://localhost:5173/home`): o **Sair** e o botão "Ir para o Lúdica" levam para lá. Vazia = o Sair volta para a tela de entrada da Cruzadinha |
| `LOGIN_DEV` | `true` fora de produção | atalhos "entrar como" e "simular entrada do Lúdica" |
| `LUDICA_URL_RETORNO_DEV` | ludica-mock | `url_retorno` sugerido no simulador (só desenvolvimento) |

Não há palavra secreta nem URL fixa da API do Lúdica: a seed já tem o prefixo
`LUD1C@` e o endereço de retorno chega na entrada.

### Cadastro no Lúdica

O administrador do Lúdica cadastra o jogo em **Gerenciar jogos**:

| Campo | Valor (rodando local) |
|---|---|
| Título | `Cruzadinha` (gera o NOMEJOGO `CRUZADINHA`) |
| URL do jogo | `http://localhost:8080/api/auth/ludica` |
| URL de status | `http://localhost:8080/api/status` |

## Desenvolvimento

`docker compose up` já sobe o serviço `ludica-mock`, que finge ser a API de
resultados do Lúdica: confere os campos e o hash como o Lúdica e mostra no log o
que chegou (`docker compose logs -f ludica-mock`). A tela de entrada tem o atalho
**Simular entrada do Lúdica**, que gera os mesmos campos e faz o POST de verdade.

Fora do Docker:

```bash
npm run ludica-mock                      # API falsa em http://localhost:4000/integracao/resultados
MOCK_FALHAR=true npm run ludica-mock     # responde 503 (testa o reenvio)
```

### Testar com o Lúdica de verdade

Branch do Lúdica: `feat/parte-sprint3` (a mais recente, com o padrão da Sprint 6).
Numa branch local (`cruzadinha-sprint6`) tiramos só a trava que impede o
**professor** de abrir o jogo — o professor precisa entrar para criar as cruzadas.
A trava que recusa **pontuação** de professor continua (na Cruzadinha professor
não joga). Achamos que essa trava é um engano do Lúdica e que eles vão corrigir.

1. Banco do Lúdica com o `Docker/init.sql` da branch nova e o seed (`node seed.js`).
2. API do Lúdica (porta 3000) com o `url_retorno` alcançável de dentro do container
   da nossa API:
   `LUDICA_URL_RETORNO=http://host.docker.internal:3000/integracao/resultados node server.js`
3. Cadastrar a Cruzadinha como na tabela acima (o seed cria "Palavras Cruzadas",
   G005; renomeie para "Cruzadinha" e troque as URLs).
4. Front do Lúdica na porta 5173; entrar com `alice` ou `prof_ana` (senha `123456`,
   digitar a gamertag, não o email) → Jogos → Cruzadinha → **Jogar**.

## Banco já existente

O `schema.sql` só roda na primeira subida. Em um banco criado antes, aplique as
migrações (podem rodar mais de uma vez):

```bash
docker compose exec -T postgres psql -U postgres -d palavras_cruzadas \
  < backend/db/postgres/migracoes/001_integracao_ludica.sql
docker compose exec -T postgres psql -U postgres -d palavras_cruzadas \
  < backend/db/postgres/migracoes/002_ludica_sprint6.sql
```

## Em aberto

- **Professor no Lúdica:** a branch deles bloqueia professor de abrir jogos. Para a
  Cruzadinha o professor precisa entrar (é ele quem cria as cruzadas).
- **Segurança:** o hash não cobre `tipo_usuario`, `pontos` nem `tempo_segundos`.
  Quem tiver um hash válido pode trocar `aluno` por `professor` na entrada ou mudar
  os pontos na volta.
- **Hospedagem:** fora do escopo; quem hospedar só ajusta as URLs no cadastro do Lúdica.
