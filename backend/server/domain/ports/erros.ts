/** Token rejeitado (Meta 190/OAuth, Helena 401/403). Não adianta repetir. */
export class ErroToken extends Error {
  constructor(motivo: string, readonly codigoExterno?: number) {
    super(motivo);
    this.name = 'ErroToken';
  }
}

/** Limite de chamadas atingido (Meta 4/80007/80008). Pode repetir com backoff. */
export class ErroLimite extends Error {
  constructor(motivo = 'limite da Meta', readonly codigoExterno?: number) {
    super(motivo);
    this.name = 'ErroLimite';
  }
}

/** Serviço externo fora do ar, lento ou 5xx. */
export class ErroIndisponivel extends Error {
  constructor(motivo = 'serviço indisponível') {
    super(motivo);
    this.name = 'ErroIndisponivel';
  }
}

/** Erro de negócio com status HTTP e código do contrato. */
export class ErroNegocio extends Error {
  constructor(readonly status: number, readonly codigo: string, mensagem: string, readonly extra?: Record<string, unknown>) {
    super(mensagem);
    this.name = 'ErroNegocio';
  }
}
