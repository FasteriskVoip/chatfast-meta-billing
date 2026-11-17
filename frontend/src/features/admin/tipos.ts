import { TOM } from '@/components/shared/tons';

export type StatusConta = 'ATIVA' | 'TOKEN_INVALIDO' | 'TOKEN_EXPIRANDO' | 'ERRO_SYNC' | 'PAUSADA';

export interface ClienteLinha {
  id: string;
  nome: string;
  companyid: string;
  status: 'ATIVO' | 'INATIVO';
  tokenChatfastUltimos4: string;
  alertaChatfast: boolean;
  contas: number;
  piorStatus: StatusConta | null;
  ultimoSync: string | null;
  alerta: boolean;
}

export interface Numero {
  id: string;
  display: string;
  nomeVerificado: string | null;
  qualidade: string;
  coletaAtiva: boolean;
  naoEncontradoNaMeta: boolean;
}

export interface Conta {
  id: string;
  wabaId: string;
  nome: string;
  status: StatusConta;
  moeda: string;
  tokenUltimos4: string;
  tokenExpiraEm: string | null;
  ultimoSync: string | null;
  ultimoErro: string | null;
  semCustoMeta: boolean;
  historicoDesde: string | null;
  sincronizando: boolean;
  numeros: Numero[];
}

export interface ClienteDetalhe extends Omit<ClienteLinha, 'contas' | 'piorStatus' | 'ultimoSync' | 'alerta'> {
  inativoDesde: string | null;
  contas: Conta[];
}

export interface Execucao {
  id: string;
  origem: string;
  status: string;
  inicio: string;
  fim: string | null;
  janelaDe: string;
  janelaAte: string;
  linhas: number;
  erro: string | null;
}

export interface Painel {
  contasComProblema: number;
  cotacaoVigente: { valor: string; vigenteDesde: string } | null;
  semCotacao: boolean;
}

export const ROTULO_STATUS: Record<StatusConta, { texto: string; cls: string }> = {
  ATIVA: { texto: 'Ativa', cls: TOM.sucesso },
  TOKEN_EXPIRANDO: { texto: 'Token expirando', cls: TOM.aviso },
  ERRO_SYNC: { texto: 'Erro no sync', cls: TOM.erro },
  TOKEN_INVALIDO: { texto: 'Token inválido', cls: TOM.erro },
  PAUSADA: { texto: 'Pausada', cls: TOM.neutro },
};

export const ROTULO_EXECUCAO: Record<string, { texto: string; cls: string }> = {
  EXECUTANDO: { texto: 'Executando', cls: TOM.marca },
  OK: { texto: 'OK', cls: TOM.sucesso },
  ERRO: { texto: 'Erro', cls: TOM.erro },
  IGNORADA: { texto: 'Ignorada', cls: TOM.neutro },
};

/** Link para ver o dashboard de um cliente com a sessão do admin (o backend aceita companyid só para admin). */
export const linkVerDashboard = (companyid: string) => {
  const p = new URLSearchParams(window.location.search);
  p.set('ver', companyid);
  return `/dashboard?${p.toString()}`;
};
