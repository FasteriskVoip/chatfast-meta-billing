import type {
  CategoriaMeta, DataISO, OrigemSync, Qualidade, StatusCliente, StatusConta, StatusExecucao, TipoPreco,
} from '../tipos.js';
import type { NumeroMeta } from './MetaGateway.js';

export interface ClienteRegistro {
  id: string;
  companyid: string;
  nome: string;
  status: StatusCliente;
  tokenChatfastCifrado: string;
  tokenChatfastUltimos4: string;
  inativoDesde: DataISO | null;
  alertaChatfast: boolean;
  /** Segmento "Cliente Taxi": filtro no admin e no relatório; só esses clientes recebem alertas de consumo. */
  taxi: boolean;
  /** Grupo de custo Fasterisk: o preço por mensagem cobrada que o cliente Taxi vê no lugar do custo da Meta. */
  grupoCustoId: string;
  /** Alertas de consumo em R$ (decimal em string); null = sem alerta. */
  limiteDiarioBrl: string | null;
  limiteMensalBrl: string | null;
  /** Último dia (diário) e primeiro dia do mês (mensal) em que o alerta foi enviado. */
  alertaDiarioEm: DataISO | null;
  alertaMensalEm: DataISO | null;
}

export interface ContaRegistro {
  id: string;
  clienteId: string;
  companyid: string;
  wabaId: string;
  nome: string;
  tokenCifrado: string;
  tokenUltimos4: string;
  tokenExpiraEm: Date | null;
  moeda: string;
  fuso: string;
  status: StatusConta;
  semCustoMeta: boolean;
  historicoDesde: DataISO | null;
  ultimoSyncEm: Date | null;
  ultimoErro: string | null;
  desatualizadoDesde: Date | null;
  syncEmAndamentoDesde: Date | null;
}

export interface NumeroRegistro {
  id: string;
  contaWabaId: string;
  companyid: string;
  phoneNumberId: string;
  display: string;
  verifiedName: string | null;
  qualidade: Qualidade;
  coletaAtiva: boolean;
  naoEncontradoNaMeta: boolean;
}

export interface ExecucaoRegistro {
  id: string;
  origem: OrigemSync;
  status: StatusExecucao;
  inicio: Date;
  fim: Date | null;
  janelaDe: DataISO;
  janelaAte: DataISO;
  linhas: number;
  erro: string | null;
}

export interface CotacaoRegistro {
  id: string;
  /** decimal em string, 4 casas */
  valor: string;
  vigenteDesde: DataISO;
  criadoPor: string;
  criadoEm: Date;
}

export interface GrupoCustoRegistro {
  id: string;
  nome: string;
  /** R$ por mensagem cobrada, decimal em string, 4 casas */
  precoBrl: string;
}

export interface NovaAuditoria {
  companyid: string;
  userId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  dados: Record<string, unknown>;
}

export type NovoCliente = Pick<ClienteRegistro, 'companyid' | 'nome' | 'tokenChatfastCifrado' | 'tokenChatfastUltimos4'> & { taxi?: boolean; grupoCustoId?: string };
export type NovaConta = Pick<
  ContaRegistro,
  'clienteId' | 'companyid' | 'wabaId' | 'nome' | 'tokenCifrado' | 'tokenUltimos4' | 'tokenExpiraEm' | 'moeda' | 'fuso'
>;

/** Cadastro: clientes, contas, números, execuções, cotações e auditoria. */
export interface ContaRepository {
  clientePorCompanyid(companyid: string): Promise<ClienteRegistro | null>;
  clientePorId(id: string): Promise<ClienteRegistro | null>;
  listarClientes(): Promise<ClienteRegistro[]>;
  criarCliente(d: NovoCliente): Promise<ClienteRegistro>;
  atualizarCliente(id: string, patch: Partial<Omit<ClienteRegistro, 'id' | 'companyid'>>): Promise<ClienteRegistro>;

  todasContas(): Promise<ContaRegistro[]>;
  contasDoCliente(clienteId: string): Promise<ContaRegistro[]>;
  contasDaEmpresa(companyid: string): Promise<ContaRegistro[]>;
  contaPorId(id: string): Promise<ContaRegistro | null>;
  contaPorWabaId(wabaId: string): Promise<ContaRegistro | null>;
  criarConta(d: NovaConta, numeros: NumeroMeta[]): Promise<ContaRegistro>;
  atualizarConta(id: string, patch: Partial<Omit<ContaRegistro, 'id' | 'companyid' | 'clienteId'>>): Promise<ContaRegistro>;
  /** UPDATE condicional: true se obteve o lock (livre ou vencido há 30 min). */
  adquirirLock(contaId: string): Promise<boolean>;
  liberarLock(contaId: string): Promise<void>;

  numerosDaConta(contaId: string): Promise<NumeroRegistro[]>;
  numerosDaEmpresa(companyid: string): Promise<NumeroRegistro[]>;
  numeroPorId(id: string): Promise<NumeroRegistro | null>;
  /** Cria os novos, atualiza os existentes e marca os sumidos como não encontrados. */
  sincronizarNumeros(conta: ContaRegistro, numeros: NumeroMeta[]): Promise<NumeroRegistro[]>;
  atualizarNumero(id: string, patch: { coletaAtiva: boolean }): Promise<NumeroRegistro>;

  iniciarExecucao(d: { companyid: string; contaWabaId: string; origem: OrigemSync; status: StatusExecucao; janelaDe: DataISO; janelaAte: DataISO }): Promise<string>;
  finalizarExecucao(id: string, d: { status: StatusExecucao; linhas: number; erro: string | null }): Promise<void>;
  listarExecucoes(contaId: string, limite: number): Promise<ExecucaoRegistro[]>;

  listarCotacoes(): Promise<CotacaoRegistro[]>;
  /** Upsert por vigenteDesde. */
  salvarCotacao(d: { valor: string; vigenteDesde: DataISO; criadoPor: string }): Promise<{ cotacao: CotacaoRegistro; substituiu: boolean }>;

  listarGruposCusto(): Promise<GrupoCustoRegistro[]>;
  /** Sem id cria; com id atualiza. */
  salvarGrupoCusto(d: { id?: string; nome: string; precoBrl: string }): Promise<GrupoCustoRegistro>;

  registrarAuditoria(d: NovaAuditoria): Promise<void>;
}

export interface FiltroFatos {
  companyid: string;
  de: DataISO;
  ate: DataISO;
  contaId?: string;
  numeroId?: string;
}

export interface LinhaConsumoNova {
  companyid: string;
  contaWabaId: string;
  numeroId: string;
  data: DataISO;
  categoria: CategoriaMeta;
  tipoPreco: TipoPreco;
  pais: string;
  tier: string;
  volume: number;
  custo: string | null;
  moeda: string;
}

export interface LinhaMensagensNova {
  companyid: string;
  contaWabaId: string;
  numeroId: string;
  data: DataISO;
  enviadas: number;
  entregues: number;
}

/** Consumo agrupado por (data, número, categoria, tipo de preço, moeda). */
export interface LinhaConsumo {
  data: DataISO;
  numeroId: string;
  contaId: string;
  categoria: CategoriaMeta;
  tipoPreco: TipoPreco;
  moeda: string;
  volume: number;
  /** soma dos custos informados; null se nenhuma linha tinha custo */
  custo: string | null;
  /** linhas sem custo no grupo (custo parcial) */
  semCusto: number;
}

export interface LinhaMensagens {
  data: DataISO;
  numeroId: string;
  enviadas: number;
  entregues: number;
}

/** Fatos diários (pricing_analytics e analytics). */
export interface ConsumoRepository {
  upsertConsumo(linhas: LinhaConsumoNova[]): Promise<number>;
  upsertMensagens(linhas: LinhaMensagensNova[]): Promise<number>;
  consumoAgregado(f: FiltroFatos): Promise<LinhaConsumo[]>;
  mensagensAgregadas(f: FiltroFatos): Promise<LinhaMensagens[]>;
}
