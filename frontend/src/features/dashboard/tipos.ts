// Espelha specs/001-consumo-meta/contracts/api.md (sem import do backend: a ponte é só HTTP).
export const GRUPOS = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;
export type Grupo = (typeof GRUPOS)[number];
export type SituacaoCusto = 'completo' | 'parcial' | 'indisponivel' | 'sem_cotacao';
export type Qualidade = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export const NOME_GRUPO: Record<Grupo, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação', SERVICE: 'Serviço',
};
// Marketing laranja (o mais caro), Utilidade azul, Autenticação vinho, Serviço água (grátis). Cores e validação em index.css.
export const COR_GRUPO: Record<Grupo, string> = {
  MARKETING: 'var(--chart-1)', UTILITY: 'var(--chart-2)', AUTHENTICATION: 'var(--chart-3)', SERVICE: 'var(--chart-4)',
};

export interface Filtros {
  contas: { id: string; nome: string; wabaId: string }[];
  numeros: { id: string; contaId: string; display: string; nomeVerificado: string | null }[];
  categorias: Grupo[];
  historicoDesde: string | null;
  fuso: string;
}

export interface Status {
  ultimoSync: string | null;
  sincronizando: boolean;
  sincronizarDisponivelEm: string | null;
  desatualizadoDesde: string | null;
  coletandoHistorico: boolean;
}

export interface Categoria {
  categoria: Grupo;
  volume: number;
  percentual: number;
  cobradas: number;
  gratuitas: number;
  custoBrl: string | null;
  custoSituacao: SituacaoCusto;
}

/** Cliente Taxi no preço Fasterisk: toda mensagem é cobrada, a tela não fala em grátis. */
export const semGratis = (r: Pick<Resumo, 'custo'>) => r.custo === 'fasterisk';

export interface Resumo {
  periodo: { de: string; ate: string; incluiHoje: boolean };
  envio: {
    enviadas: number; entregues: number; naoEntregues: number; taxaEntrega: number | null;
    mediaDiaria: number; diasComEnvio: number; diasNoPeriodo: number; pico: { data: string; enviadas: number } | null;
  };
  categorias: Categoria[];
  total: {
    volume: number; categorias: number; cobradas: number; custoBrl: string | null; custoMedioPorCobradaBrl: string | null;
    custoSituacao: SituacaoCusto; diasSemCusto: number; convertidoComCotacaoPosterior: boolean;
  };
  serieCategorias: ({ data: string } & Record<Grupo, { volume: number; custoBrl: string | null }>)[];
  serieMensagens: { data: string; enviadas: number; entregues: number }[];
  porNumero: {
    numeroId: string; conta: string; display: string; nomeVerificado: string | null; qualidade: Qualidade;
    enviadas: number; entregues: number; taxaEntrega: number | null; porCategoria: Record<Grupo, number>;
    custoBrl: string | null; percentualDoTotal: number;
  }[];
  ultimoSync: string | null;
  /** Cliente Taxi: preço do grupo Fasterisk (null nos demais). O nome do grupo só vem para o admin. */
  fasterisk: { grupo?: string; precoBrl: string } | null;
  /** Qual custo o resumo traz: preço Fasterisk (cliente Taxi) ou da Meta (demais, ou admin com custo=meta). */
  custo: 'fasterisk' | 'meta';
}

export interface FiltroAplicado {
  de: string;
  ate: string;
  contaId: string;
  numeroId: string;
  categoria: '' | Grupo;
}
