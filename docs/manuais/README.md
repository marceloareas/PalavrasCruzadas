# Manuais

Entregáveis do checkpoint de meio de período (prazo: 16/10).

| Manual | Word (.docx) | Fonte (Markdown) |
|---|---|---|
| **Manual do Desenvolvedor**: arquitetura, diagrama de implantação, ambiente de desenvolvimento, modelo lógico do banco, API, deploy em produção, backup | [Manual do Desenvolvedor - Cruzadinha Digital.docx](Manual%20do%20Desenvolvedor%20-%20Cruzadinha%20Digital.docx) | [manual-desenvolvedor.md](manual-desenvolvedor.md) |
| **Manual do Usuário**: uso por perfil (professor, aluno, administrador), com telas, diagramas de atividade e sequência, regras de negócio, perguntas frequentes | [Manual do Usuario - Cruzadinha Digital.docx](Manual%20do%20Usuario%20-%20Cruzadinha%20Digital.docx) | [manual-usuario.md](manual-usuario.md) |

`img/` guarda as capturas de tela usadas no manual do usuário.

## Regerar os .docx

Os `.docx` são gerados a partir do Markdown (os diagramas Mermaid viram imagem):

```bash
cd docs/manuais/gerador-docx
npm install
npm run gerar
```

Requisitos: Node.js 22+, Google Chrome instalado (usado para desenhar os
diagramas; outro caminho via `CHROME_PATH`) e internet (carrega o Mermaid).

O sumário é um campo do Word: ao abrir o arquivo, o Word pode perguntar se
deseja atualizar os campos — responda **Sim** (ou clique com o botão direito no
sumário → **Atualizar campo**).

## Regerar as capturas de tela

As telas foram capturadas com o navegador automatizado sobre o ambiente
recém-criado (`docker compose down -v && docker compose up -d`), entrando com
os usuários de teste. Se a interface mudar, capture de novo as telas
correspondentes em `img/` mantendo os nomes dos arquivos.
