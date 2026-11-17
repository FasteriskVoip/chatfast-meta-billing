import type { StatusCliente, StatusConta } from '../tipos.js';

/** Status que mostram a faixa "dados desatualizados" ao cliente (US-14). */
export const STATUS_PROBLEMA: ReadonlySet<StatusConta> = new Set(['TOKEN_INVALIDO', 'ERRO_SYNC', 'PAUSADA']);

/** Pior primeiro, para o selo da lista de clientes. */
export const ORDEM_GRAVIDADE: StatusConta[] = ['TOKEN_INVALIDO', 'ERRO_SYNC', 'PAUSADA', 'TOKEN_EXPIRANDO', 'ATIVA'];

export const piorStatus = (ss: StatusConta[]): StatusConta | null =>
  ORDEM_GRAVIDADE.find((s) => ss.includes(s)) ?? null;

export function coletavel(conta: { status: StatusConta }, cliente: { status: StatusCliente }): boolean {
  return cliente.status === 'ATIVO' && (conta.status === 'ATIVA' || conta.status === 'TOKEN_EXPIRANDO' || conta.status === 'ERRO_SYNC');
}

/** Após sync OK: volta a ATIVA (mantém TOKEN_EXPIRANDO, que é aviso, não falha). */
export function aposSucesso(conta: { status: StatusConta }, agora: Date) {
  return {
    status: conta.status === 'TOKEN_EXPIRANDO' ? 'TOKEN_EXPIRANDO' : 'ATIVA',
    ultimoSyncEm: agora,
    ultimoErro: null,
    desatualizadoDesde: null,
  } as const;
}

/** Após falha: guarda desde quando os dados estão parados (não sobrescreve). */
export function aposErro(
  conta: { desatualizadoDesde: Date | null },
  status: StatusConta,
  mensagem: string,
  agora: Date,
) {
  return { status, ultimoErro: mensagem, desatualizadoDesde: conta.desatualizadoDesde ?? agora };
}

export const DIAS_AVISO_EXPIRACAO = 7;

export function tokenExpirando(expiraEm: Date | null, agora: Date): boolean {
  return expiraEm !== null && expiraEm.getTime() - agora.getTime() <= DIAS_AVISO_EXPIRACAO * 86_400_000;
}
