# Gerador automático da grade

Código: [`backend/src/services/gerador.js`](../backend/src/services/gerador.js) ·
testes: [`backend/test/gerador.test.js`](../backend/test/gerador.test.js)

Na Sprint 2 o professor informava linha, coluna e direção de cada palavra. A
Sprint 3 mudou isso: **o professor cadastra só resposta e dica, e o sistema
monta a grade** (RN14).

## Entrada e validação

`validarPalavras(palavras)` roda antes de gerar e devolve a lista de erros:

| Regra | Valor | Onde mudar |
|---|---|---|
| Quantidade de palavras (RN13) | 5 a 15 | `MIN_PALAVRAS` / `MAX_PALAVRAS` em `regras.js` (e o `CHECK` em `versao_cruzada`) |
| Tamanho da resposta | 2 a 20 letras | `MIN_LETRAS` / `MAX_LETRAS` |
| Dica | obrigatória, até 300 caracteres | `MAX_DICA` |
| Repetição | a mesma resposta não pode aparecer duas vezes | — |

`normalizarResposta` deixa a resposta em maiúsculas, tira os acentos e remove
tudo que não for letra ou número: `"Chave primária"` → `"CHAVEPRIMARIA"`. É
isso que vai para a grade e é com isso que a resposta do aluno é comparada.

## Algoritmo

Guloso, com várias tentativas:

1. **Primeira palavra** na horizontal, na posição (0, 0). A grade é um `Map`
   esparso `"linha,coluna" → { letra, horizontal, vertical }`, então pode
   crescer para qualquer lado. No final tudo é deslocado para começar em (1, 1).
2. **Cada palavra seguinte** testa todas as posições em que cruza uma letra
   igual já colocada, na direção que ainda está livre naquela casa. Uma posição
   só vale se:
   - toda casa ocupada tiver a mesma letra e não for de outra palavra na mesma direção;
   - toda casa **livre** tiver os vizinhos laterais vazios (nada de palavras
     encostadas formando sequências que não existem);
   - as casas imediatamente **antes** e **depois** da palavra estiverem vazias;
   - houver pelo menos 1 cruzamento.
3. **Escolha da posição:** `pontuação = cruzamentos × 1000 − área da grade − |linhas − colunas| × 5`.
   Ou seja, primeiro mais cruzamentos, depois grade menor e mais quadrada.
4. **Palavras que não couberam** são tentadas de novo depois das outras,
   enquanto houver progresso (às vezes uma palavra só encaixa depois que outra entra).
5. **60 tentativas** com ordens diferentes:
   - a 1ª tentativa vai da maior palavra para a menor;
   - as seguintes mantêm a maior palavra primeiro e embaralham o resto;
   - a cada 7 tentativas, uma embaralha tudo.

   Fica o melhor resultado: menos palavras de fora e, no empate, menor área.
6. **Numeração** estilo jornal: os inícios de palavra são ordenados de cima
   para baixo e da esquerda para a direita. Uma horizontal e uma vertical que
   começam na mesma casa dividem o número.

### Mesma entrada, mesma grade

O embaralhamento usa um gerador pseudoaleatório (mulberry32) com **semente
derivada das respostas**. A mesma lista sempre gera a mesma grade, o que
facilita testar e depurar.

### Quando não dá para montar (RN06)

Se no melhor resultado sobrou alguma palavra, o salvamento é recusado:

```
A grade não pode ser montada com essas palavras.
• Não foi possível encaixar: XYZ. Troque por palavras que tenham letras em comum com as demais.
```

O caso típico é uma palavra sem nenhuma letra em comum com as outras.

## Saída

```js
gerarGrade(palavras) → {
  ok: true,
  linhas: 9, colunas: 12,
  palavras: [{ indice: 1, resposta: 'HERANCA', dica: '...', linha: 5, coluna: 2, direcao: 'horizontal', numero: 5 }],
  naoEncaixadas: []
}
```

- `indice` é a posição da palavra na lista do professor (1..N). É a chave
  estável usada em `resposta_sessao.indice_palavra` e nas respostas do aluno.
- `numero` é o que aparece na grade e na lista de dicas.

`montarMatriz(grade, { ocultarLetras })` transforma o resultado em matriz
(`null` = bloqueada). Com `ocultarLetras: true`, as casas viram `""`: é a
versão que o aluno recebe.

## Exemplo real (seed de Engenharia de Software)

```
P O L I M O R F I S M O
. . . N . . . . . . . B
. . A T R I B U T O . J
. . . E . . . . . . . E
. H E R A N C A . . . T
. . . F . . . . . . . O
. C L A S S E . . . . .
. . . C . . . . . . . .
. . M E T O D O . . . .
```

## Testes

`npm test` (em `backend/`) verifica, entre outras coisas:
- limites de 5 a 15 palavras, dica vazia, resposta curta e repetida;
- grade gerada **sem conflito** e **sem sequências acidentais**: toda
  sequência de 2+ letras na grade é uma das palavras cadastradas;
- determinismo (mesma entrada, mesma grade);
- 15 palavras de Banco de Dados encaixando;
- palavra sem letra em comum sendo apontada;
- matriz do aluno sem nenhuma letra.

## Limitações conhecidas

- É uma heurística: um conjunto difícil pode ser recusado mesmo que exista
  alguma grade possível. Na prática, com termos de computação de 5 a 15
  palavras, encaixa sem problema.
- Ao **editar** as palavras, a grade é gerada de novo e pode mudar bastante de
  layout. Isso é esperado, porque cada versão tem a própria grade (RN09).
