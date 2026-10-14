// Cliente da API. Lanca ErroApi com a mensagem e a lista de erros do backend.
export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro || `Erro ${status}`);
    this.status = status;
    this.erros = corpo?.erros || [];
  }
}

async function requisitar(metodo, caminho, corpo) {
  const resp = await fetch(`/api${caminho}`, {
    method: metodo,
    credentials: 'same-origin',
    headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined
  });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new ErroApi(resp.status, dados);
  return dados;
}

export const api = {
  get: (c) => requisitar('GET', c),
  post: (c, corpo = {}) => requisitar('POST', c, corpo),
  put: (c, corpo = {}) => requisitar('PUT', c, corpo),
  del: (c) => requisitar('DELETE', c)
};

export const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
