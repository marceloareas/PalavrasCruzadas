# Integração com o Lúdica

A Cruzadinha não tem cadastro nem senha: só se entra pelo Lúdica. Ao terminar
uma partida, a pontuação é enviada de volta para o Lúdica.

Código: [`services/ludica.js`](../backend/src/services/ludica.js) (token, perfis, POST),
[`services/envioLudica.js`](../backend/src/services/envioLudica.js) (fila de envio),
[`routes/auth.js`](../backend/src/routes/auth.js) (entrada).

## Ida: entrada pelo link

O usuário, logado no Lúdica, clica num link:

```
GET /api/auth/ludica?perfil=2&email=fulano@x.com&gamertag=fulano&token=<hash>
```

1. **Token:** recalculamos `hex(sha256(gamertag + AAAA-MM-DD + palavra))` e
   comparamos. A data é a do fuso `America/Sao_Paulo`. Também aceitamos a data de
   ontem, para um link gerado às 23:59 ainda funcionar às 00:01.
2. **Perfil:** o número vira o papel (`1` = professor, `2` = aluno, configuráveis).
3. **Usuário:** é procurado pela gamertag (coluna `usertag`). Se não existe, é
   criado; se existe, email e papel são atualizados. O **administrador** só é
   definido aqui no banco e nunca é rebaixado pelo Lúdica.
4. Se tudo está certo, a API cria a sessão e redireciona para `/`, que leva à
   página inicial do papel. Senão, redireciona para `/login?erro=<motivo>`
   (`token`, `perfil`, `email` ou `dados`), e a tela mostra "Acesso negado".

Acessar a URL da Cruzadinha diretamente leva à tela "Acesse pelo Lúdica".

## Volta: envio da pontuação

Quando a partida termina (acertou tudo ou encerrou), é feito um POST para
`LUDICA_URL_PONTUACAO`:

```json
{ "email": "...", "gamertag": "...", "pontuacao": 870, "token": "<hash>" }
```

O token segue a mesma regra, com `LUDICA_SEGREDO_ENVIO` (por padrão é a mesma
palavra). Se `LUDICA_ID_JOGO` estiver definido, vai junto como `id_jogo`.

- A partida é marcada como `ludica_envio = 'pendente'` na mesma transação que
  grava a pontuação. O envio é feito depois do commit, sem atrasar a resposta ao
  aluno.
- Se falhar, um laço de reenvio tenta de novo com espera crescente
  (1, 2, 4… até 60 min). Depois de 10 falhas, a partida fica como `'falhou'`;
  o motivo fica em `ludica_erro`.
- Cada partida é reservada por um `UPDATE` atômico antes do envio, então nunca é
  enviada duas vezes ao mesmo tempo (o Lúdica **soma** os pontos).
- Partidas anteriores à integração ficam com `ludica_envio = NULL` e não são enviadas.

Para ver o que está pendente ou falhou:

```sql
SELECT id_sessao, ludica_envio, ludica_tentativas, ludica_erro
  FROM sessao_jogo WHERE ludica_envio <> 'enviado';
```

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `LUDICA_SEGREDO` | — (obrigatória) | palavra fixa do token de entrada; sem ela ninguém entra |
| `LUDICA_SEGREDO_ENVIO` | = `LUDICA_SEGREDO` | palavra do token no envio da pontuação |
| `LUDICA_HASH` | `sha256` | algoritmo do hash (`md5`, `sha1`…) |
| `LUDICA_FUSO` | `America/Sao_Paulo` | fuso da data usada no token |
| `LUDICA_PERFIL_PROFESSOR` / `_ALUNO` | `1` / `2` | número de cada perfil no Lúdica |
| `LUDICA_URL_PONTUACAO` | — | API de pontuação; vazia = pontuações ficam pendentes |
| `LUDICA_ID_JOGO` | — | id da Cruzadinha no Lúdica (opcional) |
| `LUDICA_URL_SITE` | — | botão "Ir para o Lúdica" na tela de entrada |
| `LOGIN_DEV` | `true` fora de produção | atalhos "entrar como" e "simular link" |

## Desenvolvimento

`docker compose up` já sobe o serviço `ludica-mock`, que finge ser a API de
pontuação: ele confere o token e mostra no log o que chegou
(`docker compose logs -f ludica-mock`). A tela de entrada tem o botão
**Simular link do Lúdica**, que gera o mesmo link que o Lúdica geraria e passa
pelo fluxo real.

Fora do Docker:

```bash
npm run ludica-mock                                        # API falsa na porta 4000
MOCK_FALHAR=true npm run ludica-mock                       # responde 503 (testa o reenvio)
npm run link-ludica -- aluno.bruno 2 bruno.lima@aluno.cefet-rj.br   # imprime um link válido
```

### Testar com o Lúdica de verdade

Testado em 11/11/2026 com o [repositório do Lúdica](https://github.com/marceloareas/Ludica)
rodando na mesma máquina. Numa branch local, adicionamos a ele o lado da
integração que ainda não existe por lá:
- `GET /cruzadinha/link` (exige o JWT do login) gera o link com o token;
- `POST /cruzadinha/pontuacao` confere o token e grava em `historico_partida` e `pontuacao`;
- o botão "Jogar" do jogo `CRUZD` chama esse link;
- o seed cria o jogo `CRUZD` e o usuário `prof.marcelo`, com `tipo_usuario` Professor.

Palavra secreta de teste nos dois lados: **`jabuticaba`**. É o padrão do
compose de dev; em produção use outra.

O Lúdica usa fixo as portas 3000 (API) e 5433 (Postgres). Por isso, no `.env` da
raiz da Cruzadinha:

```
PG_PORTA=5434
API_PORTA=3001
LUDICA_URL_PONTUACAO=http://host.docker.internal:3000/cruzadinha/pontuacao
LUDICA_URL_SITE=http://localhost:5173
```

Subindo tudo:

```bash
docker compose up -d                      # Cruzadinha (8080)
cd ../Ludica/Docker && docker compose up -d
cd ../back-end && npm ci && node seed.js && node server.js   # API do Lúdica (3000)
cd ../front-end && npm ci && npx vite     # Lúdica (5173)
```

Fluxo: entrar no Lúdica (`alice` / `123456`, ou `prof.marcelo` / `123456`) →
Jogos → Cruzadinha → **Jogar**. Ao terminar a partida, os pontos aparecem no
histórico do jogo no Lúdica.

Resultado do teste:
- o link do Lúdica loga na Cruzadinha e cria o usuário (aluno e professor);
- a partida terminada aparece no histórico e na pontuação acumulada do Lúdica;
- com a API do Lúdica desligada, a partida fica pendente e é entregue sozinha
  quando ela volta;
- trocar `perfil=2` por `perfil=1` no link de um aluno faz ele entrar como
  professor. Ver "Em aberto" abaixo.

## Banco já existente

O `schema.sql` só roda na primeira subida. Em um banco criado antes desta
versão, aplique a migração (pode rodar mais de uma vez):

```bash
docker compose exec -T postgres psql -U postgres -d palavras_cruzadas \
  < backend/db/postgres/migracoes/001_integracao_ludica.sql
```

## Em aberto com o Lúdica

O [repositório do Lúdica](https://github.com/marceloareas/Ludica) ainda não
implementa este lado da integração. Os padrões acima são palpites e devem ser
confirmados com eles:

- **Regra exata do hash:** algoritmo, ordem e separador dos campos, formato da
  data e fuso. O ideal é pedir um exemplo pronto (entrada → hash esperado) e
  colocá-lo em `test/ludica.test.js`.
- **Números dos perfis.** Hoje o Lúdica só tem `tipo_usuario` =
  Administrador/Jogador, sem distinguir professor de aluno.
- **API de pontuação:** URL e formato. O `POST /score` atual deles recebe
  `{ id_usuario, id_jogo, pontos }` (id interno deles, não email/gamertag) e
  ainda tem um bug: o controller chama `addscore`, mas o service exporta
  `addScore`, então toda chamada responde 500.
- **Segurança (confirmado no teste):** o token só assina gamertag e data. Quem
  tiver um link de aluno pode trocar `perfil` ou `email` e o token continua
  válido, o dia todo; um aluno vira professor só editando a URL. Sugestão:
  incluir perfil e email no hash, por exemplo `sha256(gamertag + perfil + email + data + palavra)`.
