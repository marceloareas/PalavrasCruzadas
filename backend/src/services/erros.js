// Erros de negocio; o handler em app.js converte cada um no status HTTP certo.
export class ErroNegocio extends Error {
  constructor(mensagem, { status = 400, erros = [] } = {}) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.status = status;
    this.erros = erros;
  }
}

export const validacao = (erros, mensagem = 'Verifique os dados informados.') =>
  new ErroNegocio(mensagem, { status: 422, erros });
export const naoEncontrado = (mensagem = 'Registro nao encontrado.') =>
  new ErroNegocio(mensagem, { status: 404 });
export const proibido = (mensagem) => new ErroNegocio(mensagem, { status: 403 });
export const conflito = (mensagem) => new ErroNegocio(mensagem, { status: 409 });
