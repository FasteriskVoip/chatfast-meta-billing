// Tipos de negócio puros (espelham os enums do Prisma sem depender dele).
export const CATEGORIAS_META = [
  'MARKETING', 'MARKETING_LITE', 'UTILITY', 'AUTHENTICATION',
  'AUTHENTICATION_INTERNATIONAL', 'SERVICE', 'REFERRAL_CONVERSION', 'OUTRA',
] as const;
export type CategoriaMeta = (typeof CATEGORIAS_META)[number];

export const TIPOS_PRECO = ['REGULAR', 'FREE_CUSTOMER_SERVICE', 'FREE_ENTRY_POINT', 'OUTRO'] as const;
export type TipoPreco = (typeof TIPOS_PRECO)[number];

export const GRUPOS = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;
export type Grupo = (typeof GRUPOS)[number];

export type StatusConta = 'ATIVA' | 'TOKEN_INVALIDO' | 'TOKEN_EXPIRANDO' | 'ERRO_SYNC' | 'PAUSADA';
export type StatusCliente = 'ATIVO' | 'INATIVO';
export type Qualidade = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
export type OrigemSync = 'CICLO' | 'ADMIN' | 'CLIENTE';
export type StatusExecucao = 'EXECUTANDO' | 'OK' | 'ERRO' | 'IGNORADA';

/** Data de calendário 'YYYY-MM-DD' (sem fuso). */
export type DataISO = string;
