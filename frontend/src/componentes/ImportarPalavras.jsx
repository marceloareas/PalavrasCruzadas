// Painel "Colar lista": o professor cola (ou carrega de um arquivo) as
// palavras no formato RESPOSTA;dica, uma por linha, em vez de digitar
// campo por campo. O balao "?" mostra o formato e um exemplo.
import { useId, useMemo, useRef, useState } from 'react';
import { EXEMPLO, interpretarTexto } from '../importacao.js';

// Planilhas salvas como CSV no Windows costumam vir em Windows-1252;
// tenta UTF-8 e, se nao for valido, cai para Windows-1252 (acentos ok).
async function lerArquivo(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function BalaoDica({ children, rotulo = 'Ajuda' }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  return (
    <span className={`balao ${aberto ? 'aberto' : ''}`} onMouseLeave={() => setAberto(false)}>
      <button
        type="button"
        className="balao-gatilho"
        aria-label={rotulo}
        aria-describedby={id}
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
        onBlur={() => setAberto(false)}
      >
        ?
      </button>
      <span role="tooltip" id={id} className="balao-conteudo">{children}</span>
    </span>
  );
}

export default function ImportarPalavras({ regras, atuais, onImportar, onFechar }) {
  const [texto, setTexto] = useState('');
  const [erroArquivo, setErroArquivo] = useState(null);
  const arquivoRef = useRef(null);
  const max = regras?.maxPalavras ?? 15;
  const min = regras?.minPalavras ?? 5;

  const { palavras, erros } = useMemo(() => interpretarTexto(texto, regras ?? {}), [texto, regras]);
  const preenchidas = atuais.filter((p) => p.resposta.trim() || p.dica.trim()).length;

  const carregar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErroArquivo(null);
    try {
      setTexto(await lerArquivo(arquivo));
    } catch {
      setErroArquivo('Não foi possível ler o arquivo. Tente copiar e colar o conteúdo.');
    }
  };

  const bloqueio = (total) => {
    if (!texto.trim()) return 'Cole as palavras na caixa acima.';
    if (erros.length) return 'Corrija as linhas indicadas para importar.';
    if (!palavras.length) return 'Nenhuma palavra encontrada no texto.';
    if (total > max) return `Ficariam ${total} palavras; o máximo é ${max}.`;
    return null;
  };
  const bloqueioSubstituir = bloqueio(palavras.length);
  const bloqueioAdicionar = bloqueio(preenchidas + palavras.length);

  return (
    <div className="importar stack">
      <div className="importar-head">
        <strong>Colar lista de palavras</strong>
        <BalaoDica rotulo="Como montar a lista">
          <strong>Uma palavra por linha</strong>, com a resposta e a dica separadas por
          ponto e vírgula (<code>;</code>):
          <pre>{'RESPOSTA;Dica que o aluno vai ler\nBRASIL;País onde fica o CEFET-RJ\nATOMO;Menor parte de um elemento químico'}</pre>
          Acentos e espaços na resposta são aceitos (viram letras sem acento na grade).
          Linhas em branco ou começando com <code>#</code> são ignoradas. Dá para
          montar numa planilha (coluna A = resposta, coluna B = dica) e salvar como
          CSV separado por ponto e vírgula.
        </BalaoDica>
      </div>

      <textarea
        className="importar-texto"
        rows={8}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`Exemplo (uma palavra por linha, RESPOSTA;dica):\n\n${EXEMPLO}`}
        aria-label="Lista de palavras no formato RESPOSTA;dica"
        spellCheck={false}
      />

      <div className="acoes">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTexto(EXEMPLO)}>
          Usar o exemplo
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => arquivoRef.current?.click()}>
          Carregar arquivo .txt / .csv
        </button>
        <input ref={arquivoRef} type="file" accept=".txt,.csv,text/plain,text/csv" hidden onChange={carregar} />
        {texto && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTexto('')}>Limpar</button>
        )}
      </div>

      {erroArquivo && <div className="alert alert-erro">{erroArquivo}</div>}

      {texto.trim() && (
        <div className="importar-previa">
          <p className="small">
            <strong>{palavras.length}</strong> {palavras.length === 1 ? 'palavra reconhecida' : 'palavras reconhecidas'}
            {palavras.length > 0 && palavras.length < min && (
              <span className="muted"> (o jogo precisa de pelo menos {min})</span>
            )}
          </p>
          {erros.length > 0 && (
            <ul className="importar-erros">
              {erros.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="acoes">
        <button
          type="button"
          className="btn btn-sm"
          disabled={Boolean(bloqueioSubstituir)}
          title={bloqueioSubstituir ?? ''}
          onClick={() => onImportar(palavras, 'substituir')}
        >
          Substituir as palavras do formulário
        </button>
        {preenchidas > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={Boolean(bloqueioAdicionar)}
            title={bloqueioAdicionar ?? ''}
            onClick={() => onImportar(palavras, 'adicionar')}
          >
            Adicionar às {preenchidas} atuais
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>Fechar</button>
      </div>
      {texto.trim() && (bloqueioSubstituir || (preenchidas > 0 && bloqueioAdicionar)) && (
        <p className="muted small">{bloqueioSubstituir ?? bloqueioAdicionar}</p>
      )}
    </div>
  );
}
