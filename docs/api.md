# API REST

Base: `http://localhost:8080/api` (pelo nginx) ou `http://localhost:3000/api` (direto na API).
Tudo é JSON. A autenticação é por cookie de sessão (`cruzadinha.sid`), obtido em `/auth/entrar` ou `/auth/ludica`.

## Convenções

| Status | Quando |
|---|---|
| 200 / 201 / 204 | ok / criado / sem conteúdo |
| 400 | JSON malformado |
| 401 | não está logado — `{ "erro": "Faça login para continuar." }` |
| 403 | papel errado ou recurso de outro usuário |
| 404 | não existe (ou jogo não publicado, para o aluno) |
| 409 | conflito: código de disciplina repetido, solicitação já respondida, partida já encerrada, excluir cruzada já jogada |
| 422 | validação — `{ "erro": "...", "erros": ["...", "..."] }` |

Papéis: `professor`, `aluno`, `administrador`.

---

## Público

### `GET /health`
`{ "status": "ok" }` se Postgres e Mongo respondem, senão `503`.

### `GET /regras`
Limites usados também pelo front.
```json
{ "minPalavras": 5, "maxPalavras": 15, "minLetras": 2, "maxLetras": 20, "maxDica": 300,
  "maxDicasPorPartida": 3, "descontoPorLetra": 0.2 }
```

## Autenticação (simulada — ver [arquitetura.md](arquitetura.md#autenticação-provisória))

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/auth/usuarios` | — | lista de usuários (para "entrar como") |
| POST | `/auth/entrar` | `{ "id_usuario": 1 }` | usuário logado |
| POST | `/auth/ludica` | `{ "id": 1003, "usertag": "prof.novo", "email": "...", "papel": "professor", "nome": "opcional" }` | usuário criado/atualizado e logado |
| GET | `/auth/eu` | — | usuário da sessão ou `null` |
| POST | `/auth/sair` | — | 204 |

Usuário: `{ id_usuario, id_ludica, usertag, nome, email, papel }`.

---

## Professor

### `GET /professor/cruzadas`
Painel: as cruzadas do professor logado e estatísticas (só partidas encerradas).
```json
{
  "estatisticas": { "jogos_criados": 2, "alunos_ativos": 3, "media_acertos": 47 },
  "cruzadas": [{
    "id_cruzada": 1, "titulo": "...", "codigo_acesso": "ES-38054", "dificuldade": "medio",
    "status": "publicado", "disciplina": "Engenharia de Software", "versao_atual": 1,
    "qtd_palavras": 7, "resolucoes": 3, "tempo_medio": 271, "data_atualizacao": "..."
  }]
}
```

### `POST /professor/cruzadas`
Cria a cruzada (versão 1). **Só respostas e dicas**: a grade é gerada pelo sistema.
```json
{
  "titulo": "Redes — Camadas", "descricao": "opcional",
  "id_disciplina": 6, "dificuldade": "medio", "status": "publicado",
  "palavras": [ { "resposta": "Roteador", "dica": "Encaminha pacotes entre redes" }, "... (5 a 15)" ]
}
```
→ `201 { "idCruzada": 5, "numeroVersao": 1, "idVersao": 5 }`

Erros 422 possíveis: título vazio, disciplina inexistente ou desativada,
dificuldade/status inválidos, fora de 5–15 palavras, resposta fora de 2–20
letras, dica vazia, resposta repetida, ou **palavra que não encaixa na grade**
(`"Não foi possível encaixar: XYZ. ..."`).

### `GET /professor/cruzadas/:id` — só o autor
Cabeçalho, versão atual, **gabarito**, matriz preenchida, versões, ranking e partidas.
```json
{
  "id_cruzada": 1, "titulo": "...", "disciplina": "...", "codigo_acesso": "...", "status": "...",
  "versao_atual": { "id_versao": 1, "numero_versao": 1, "qtd_palavras": 7, "linhas": 9, "colunas": 12 },
  "versoes": [{ "numero_versao": 1, "qtd_palavras": 7, "sessoes": 3, "data_criacao": "..." }],
  "palavras": [{ "indice": 1, "numero": 5, "resposta": "HERANCA", "dica": "...", "linha": 5, "coluna": 2, "direcao": "horizontal" }],
  "matriz": [[null, "P", "O", "..."]],
  "ranking": [ "... (ver /jogos/:id)" ],
  "partidas": [{ "id_sessao": 1, "nome": "...", "usertag": "...", "numero_versao": 1, "fim": "...", "tempo": 272, "tentativas": 3, "acertos": 6, "erros": 7, "qtd_palavras": 7, "pontuacao": 588 }]
}
```

### `PUT /professor/cruzadas/:id` — só o autor
Mesmo corpo do `POST`. Se as palavras (resposta + dica, na ordem) mudaram,
cria uma **nova versão** com grade nova. Senão, só atualiza o cabeçalho.
→ `{ "idCruzada": 5, "numeroVersao": 2, "novaVersao": true }`

### `DELETE /professor/cruzadas/:id` — só o autor
`204`. Se já existem partidas, devolve `409` pedindo para arquivar (status `arquivado`).

---

## Aluno

### `GET /jogos?texto=&codigo=&disciplina=&dificuldade=`
Busca jogos **publicados** (até 50). `texto` procura em título, descrição,
disciplina e nome do professor. `codigo` é o código de acesso exato.
```json
[{ "id_cruzada": 3, "titulo": "...", "descricao": "...", "dificuldade": "facil", "codigo_acesso": "BD-27372",
   "disciplina": "Banco de Dados", "autor_nome": "Ana Souza", "qtd_palavras": 8,
   "partidas": 0, "minhas_partidas": 0 }]
```

### `GET /jogos/:id`
Página do jogo **sem respostas** (RN11).
```json
{
  "id_cruzada": 3, "titulo": "...", "dificuldade": "facil", "codigo_acesso": "...", "disciplina": "...", "autor_nome": "...", "versao": 1,
  "grade": [[null, "", "", "..."]],
  "numeros": [{ "numero": 1, "linha": 1, "coluna": 4 }],
  "horizontais": [{ "indice": 7, "numero": 1, "direcao": "horizontal", "linha": 1, "coluna": 4, "tamanho": 8, "dica": "..." }],
  "verticais": ["..."],
  "sessao_aberta": null,
  "minhas_sessoes": [{ "id_sessao": 9, "numero_versao": 1, "fim": "...", "tempo": 3, "tentativas": 2, "acertos": 8, "qtd_palavras": 8, "pontuacao": 844 }],
  "ranking": [{ "posicao": 1, "id_aluno": 3, "nome": "...", "usertag": "...", "pontuacao": 844, "tempo": 3, "acertos": 8, "tentativas": 2, "dicas": 0, "qtd_palavras": 8, "numero_versao": 1 }]
}
```
Na `grade`, `null` é casa bloqueada e `""` é casa a preencher.

### Partida — ver [jogo-e-pontuacao.md](jogo-e-pontuacao.md)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/jogos/:id/sessoes` | — | `201 { "id_sessao": 9, "retomada": false }` (retomada = já havia partida aberta nessa versão) |
| GET | `/sessoes/:id` | — | estado da partida (abaixo) |
| POST | `/sessoes/:id/conferir` | `{ "respostas": { "1": "ROLLBACK", "2": "CHAVE", "...": "..." } }` | `{ "tentativa": 1, "certas": 3, "total": 8, "concluida": false }` |
| POST | `/sessoes/:id/dica` | `{ "indice": 1, "atual": "RO      " }` | `{ "linha": 1, "coluna": 6, "letra": "L", "dicas_restantes": 2 }` (RN20) |
| POST | `/sessoes/:id/encerrar` | — | `{ "encerrada": true }` |

As chaves de `respostas` são o `indice` de cada palavra. Acentos e caixa são
normalizados (`"Transação"` = `"TRANSACAO"`). Palavra não enviada conta como errada.

`GET /sessoes/:id`, com a partida **aberta**:
```json
{
  "id_sessao": 9, "id_cruzada": 3, "titulo": "...", "disciplina": "...", "dificuldade": "facil",
  "versao": 1, "total_palavras": 8, "inicio": "...", "decorrido": 42, "encerrada": false,
  "tentativas": [{ "tentativa": 1, "certas": 3 }],
  "ultimas_respostas": { "1": "ROLLBACK", "2": "XXXXX" },
  "dicas": [{ "linha": 1, "coluna": 6, "letra": "L" }], "dicas_restantes": 2, "desconto_por_letra": 0.2,
  "grade": "...", "numeros": "...", "horizontais": "...", "verticais": "..."
}
```
Depois de **encerrada**, vêm também:
```json
{
  "pontuacao": 844, "tempo": 3,
  "resultado": { "certas": 8, "total": 8, "completa": true, "acertos_por_tentativa": { "1": 3, "2": 5 },
                 "multiplicador_dificuldade": 1, "pontos_palavras": 650, "desconto_dicas": 0,
                 "bonus_tempo": 129, "bonus_completa": 65, "dicas_usadas": 0 },
  "gabarito": {
    "matriz": [["R", "O", "..."]],
    "palavras": [{ "indice": 1, "numero": 1, "direcao": "horizontal", "resposta": "ROLLBACK", "informada": "ROLLBACK", "correta": true }]
  }
}
```
Erros: `403` partida de outro aluno, `409` conferir/encerrar/pedir dica em partida já encerrada.

**Dica (`/sessoes/:id/dica`):** `atual` é o que o aluno tem na tela para a palavra `indice` (`' '` = casa vazia). O servidor revela a primeira casa vazia ainda não revelada (ou, se a palavra estiver toda preenchida, a primeira não revelada). `409` na 4ª dica ou se todas as letras da palavra já foram reveladas; `422` se a palavra não existir.

---

## Disciplinas e solicitações

| Método | Rota | Quem | Corpo / resposta |
|---|---|---|---|
| GET | `/disciplinas` | logado | ativas: `[{ id_disciplina, nome, codigo, ativa, total_cruzadas }]` |
| GET | `/disciplinas?todas=1` | administrador | inclui as inativas |
| POST | `/disciplinas` | administrador | `{ nome, codigo }` → 201 (código em maiúsculas; repetido = 409) |
| PUT | `/disciplinas/:id` | administrador | `{ nome, codigo, ativa? }` |
| DELETE | `/disciplinas/:id` | administrador | `{ resultado: "excluida" }`, ou `{ resultado: "desativada", total_cruzadas }` se tiver jogos (RN15) |
| GET | `/solicitacoes?status=` | professor (as suas) / administrador (todas) | lista, pendentes primeiro |
| POST | `/solicitacoes` | professor | `{ nome, codigo_sugerido?, justificativa? }` → 201 |
| POST | `/solicitacoes/:id/responder` | administrador | `{ aprovar: true, nome?, codigo?, resposta? }` cria a disciplina; `{ aprovar: false, resposta? }` recusa |

---

## Testando na mão

Com `curl` no Git Bash do Windows, os acentos podem chegar errados na API
(`ENDEREÇO` vira `ENDEREO`), porque o terminal não manda UTF-8. Use um arquivo:

```bash
curl -c cookie.txt -H 'Content-Type: application/json' -d '{"id_usuario":1}' localhost:8080/api/auth/entrar
curl -b cookie.txt -H 'Content-Type: application/json' --data-binary @corpo.json localhost:8080/api/professor/cruzadas
```
