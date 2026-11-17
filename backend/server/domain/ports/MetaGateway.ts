import type { CategoriaMeta, Qualidade, TipoPreco } from '../tipos.js';

export interface InfoToken {
  valido: boolean;
  /** null = não expira */
  expiraEm: Date | null;
  escopos: string[];
  motivo?: string;
}

export interface InfoWaba {
  nome: string;
  moeda: string;
  /** timezone_id cru da Meta (pode ser numérico); o domínio converte para IANA. */
  fusoMeta: string | null;
}

export interface NumeroMeta {
  phoneNumberId: string;
  display: string;
  verifiedName: string | null;
  qualidade: Qualidade;
}

export interface PontoPreco {
  inicioUnix: number;
  /** display do número (dimensão PHONE) */
  telefone: string | null;
  pais: string;
  categoria: CategoriaMeta;
  tipoPreco: TipoPreco;
  tier: string;
  volume: number;
  /** decimal em string; null = a Meta não informou */
  custo: string | null;
}

export interface PontoEnvio {
  inicioUnix: number;
  enviadas: number;
  entregues: number;
}

/** Único contrato com a Graph API. Tokens vão só no header. */
export interface MetaGateway {
  validarToken(token: string): Promise<InfoToken>;
  obterWaba(token: string, wabaId: string): Promise<InfoWaba>;
  listarNumeros(token: string, wabaId: string): Promise<NumeroMeta[]>;
  pricingAnalytics(token: string, wabaId: string, inicioUnix: number, fimUnix: number): Promise<PontoPreco[]>;
  analytics(token: string, wabaId: string, telefone: string, inicioUnix: number, fimUnix: number): Promise<PontoEnvio[]>;
}
