export interface Agente {
  id: string;
  userId: string;
  nome: string;
  isOwner: boolean;
  profile: string | null;
}

export interface HelenaGateway {
  /** null quando o agente não existe na conta do token. */
  obterAgente(token: string, id: string): Promise<Agente | null>;
  listarAgentes(token: string): Promise<Agente[]>;
}
