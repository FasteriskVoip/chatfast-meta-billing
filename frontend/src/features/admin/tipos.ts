import { TOM } from '@/components/shared/tons';

export type StatusConta = 'ATIVA' | 'TOKEN_INVALIDO' | 'TOKEN_EXPIRANDO' | 'ERRO_SYNC' | 'PAUSADA';

export interface ClienteLinha {
  id: string;
  nome: string;
  companyid: string;
  status: 'ATIVO' | 'INATIVO';
  tokenChatfastUltimos4: string;
  alertaChatfast: boolean;
  /** Cliente Taxi: filtro no admin/relatório; só esses recebem alertas de consumo. */
  taxi: boolean;
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
  /** Alertas de consumo em R$ (null = sem alerta) e quando foram enviados no dia/mês corrente. */
  limiteDiarioBrl: string | null;
  limiteMensalBrl: string | null;
  alertaDiarioEm: string | null;
  alertaMensalEm: string | null;
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
  /** N8N_WEBHOOK_ALERTAS configurado no servidor. */
  alertasAtivos: boolean;
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
/** Volta ao /admin mantendo os parâmetros do embed (company_id, user_id), sem o ?ver=. */
export const linkAdmin = () => {
  const p = new URLSearchParams(window.location.search);
  p.delete('ver');
  return `/admin?${p.toString()}`;
};

export const linkVerDashboard = (companyid: string) => {
  const p = new URLSearchParams(window.location.search);
  p.set('ver', companyid);
  return `/dashboard?${p.toString()}`;
};

/** GET /admin/consumo: custo estimado de cada cliente no mês (mesmo cálculo do dashboard). */
export interface ConsumoMes {
  periodo: { mes: string; de: string; ate: string };
  clientes: {
    clienteId: string; mensagens: number; cobradas: number; gratuitas: number;
    custoBrl: string | null; custoSituacao: 'completo' | 'parcial' | 'indisponivel' | 'sem_cotacao';
  }[];
  /** Soma dos custos conhecidos (null = nenhum conhecido, nunca 0) e se algum cliente ficou sem custo completo. */
  total: { custoBrl: string | null; incompleto: boolean };
}
