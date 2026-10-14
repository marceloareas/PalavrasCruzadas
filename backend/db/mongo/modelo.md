# Modelo MongoDB — banco `palavras_cruzadas`

O MongoDB guarda o **conteúdo** de cada versão de uma cruzada: as palavras
(resposta + dica) e a grade gerada pelo sistema. O PostgreSQL guarda os
metadados (cruzada, versão, autor, disciplina) e as sessões de jogo.

## Por que separar assim

- **A versão é imutável (RN09).** Editar uma cruzada cria uma versão nova,
  então o documento de uma versão nunca é atualizado — não existe risco de
  ficar inconsistente com o Postgres.
- **É sempre lido inteiro.** Para mostrar ou jogar uma cruzada o sistema
  precisa de todas as palavras e da grade de uma vez: um único `findOne`.
- **Formato de documento.** Uma lista de 5 a 15 palavras com posição na grade
  é naturalmente um array dentro de um documento, sem precisar de JOIN.

## Coleção `conteudo_versao`

Um documento por linha de `versao_cruzada` (Postgres). A ligação é o
`id_versao`, com índice único.

```js
{
  _id: ObjectId,
  id_versao: 42,            // = versao_cruzada.id_versao (índice único)
  id_cruzada: 7,            // = palavra_cruzada.id_cruzada (índice)
  grade: { linhas: 9, colunas: 12 },
  palavras: [               // 5 a 15 itens (RN13)
    {
      indice: 1,            // posição na lista do professor (1..15)
                            //   -> resposta_sessao.indice_palavra
      numero: 5,            // número exibido na grade (estilo jornal)
      resposta: "HERANCA",  // normalizada: maiúsculas, sem acento
      dica: "Mecanismo de reuso onde uma classe deriva de outra.",
      linha: 5,             // 1-indexado, gerado pelo sistema (RN14)
      coluna: 2,
      direcao: "horizontal" // "horizontal" | "vertical"
    }
  ],
  criado_em: ISODate
}
```

### Validação no próprio Mongo

A coleção é criada com `$jsonSchema` (ver `src/db/mongo.js`), que exige os
campos acima, `palavras` entre 5 e 15 itens e `direcao` em
`horizontal | vertical`.

### Consistência entre os dois bancos

Não existe transação entre PostgreSQL e MongoDB. Ao salvar uma versão a API:

1. abre a transação no Postgres e insere `palavra_cruzada` / `versao_cruzada`;
2. insere o documento no Mongo;
3. faz o `COMMIT` no Postgres — se o passo 2 falhar, faz `ROLLBACK`; se o
   `COMMIT` falhar, apaga o documento inserido no passo 2.

Ao excluir uma cruzada, as versões somem do Postgres (`ON DELETE CASCADE`) e
os documentos com aquele `id_cruzada` são apagados do Mongo.

### RN11 — respostas escondidas do aluno

O aluno nunca recebe o campo `resposta`: a API monta para ele apenas a grade
vazia (quais células existem), os números e as dicas.
