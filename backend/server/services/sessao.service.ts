import type { Cifra } from '../domain/ports/Cifra.js';
import type { Agente, HelenaGateway } from '../domain/ports/HelenaGateway.js';
import { ErroIndisponivel, ErroNegocio, ErroToken } from '../domain/ports/erros.js';
import type { ContaRepository } from '../domain/ports/repositorios.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ponytail: a Helena não documenta os valores de `profile` (research R-07). Confirmar com chamada real
// na conta da Fasterisk (T042) e ajustar; isOwner já cobre o dono da conta.
export const PERFIS_ADMIN = new Set(['ADMIN', 'ADMINISTRATOR', 'ADMINISTRADOR']);

export function ehAdmin(companyid: string, agente: Agente, adminCompanyids: string[]): boolean {
  if (!adminCompanyids.includes(companyid.toLowerCase())) return false;
  return agente.isOwner || PERFIS_ADMIN.has((agente.profile ?? '').toUpperCase());
}

export interface SessaoAberta {
  token: string;
  expiraEm: string;
  nome: string;
  admin: boolean;
  empresa: { nome: string };
}

interface Deps {
  repo: ContaRepository;
  helena: HelenaGateway;
  cifra: Cifra;
  adminCompanyids: string[];
  emitir: (d: { cid: string; uid: string; nome: string; admin: boolean }) => { token: string; exp: number };
  cacheMs?: number;
  agora?: () => number;
}

export type SessaoService = ReturnType<typeof criarSessaoService>;

export function criarSessaoService(d: Deps) {
  const agora = d.agora ?? Date.now;
  const ttl = d.cacheMs ?? 5 * 60 * 1000;
  // ponytail: cache em memória por processo; se houver várias réplicas, cada uma consulta a Helena.
  const cache = new Map<string, { agente: Agente | null; expira: number }>();

  async function buscarAgente(companyid: string, token: string, userId: string): Promise<Agente | null> {
    const chave = `${companyid}:${userId}`;
    const hit = cache.get(chave);
    if (hit && hit.expira > agora()) return hit.agente;
    const direto = await d.helena.obterAgente(token, userId);
    const agente =
      direto && (direto.id === userId || direto.userId === userId)
        ? direto
        : ((await d.helena.listarAgentes(token)).find((a) => a.id === userId || a.userId === userId) ?? null);
    cache.set(chave, { agente, expira: agora() + ttl });
    return agente;
  }

  return {
    async abrir(companyid: string | undefined, userId: string | undefined): Promise<SessaoAberta> {
      if (!companyid || !userId || !UUID.test(companyid) || userId.length > 100) {
        throw new ErroNegocio(401, 'SEM_USUARIO', 'Usuário ou empresa não informados');
      }
      const cid = companyid.toLowerCase();
      const cliente = await d.repo.clientePorCompanyid(cid);
      if (!cliente) throw new ErroNegocio(404, 'SEM_CADASTRO', 'Conta não cadastrada. Fale com a Fasterisk');
      if (cliente.status === 'INATIVO') throw new ErroNegocio(403, 'CLIENTE_INATIVO', 'Conta desativada. Fale com a Fasterisk');

      let agente: Agente | null;
      try {
        agente = await buscarAgente(cid, d.cifra.decifrar(cliente.tokenChatfastCifrado), userId);
      } catch (err) {
        if (err instanceof ErroToken) {
          if (!cliente.alertaChatfast) await d.repo.atualizarCliente(cliente.id, { alertaChatfast: true });
          throw new ErroNegocio(502, 'HELENA_RECUSOU_TOKEN', 'Integração com o Chatfast precisa ser atualizada. Fale com a Fasterisk');
        }
        if (err instanceof ErroIndisponivel) {
          throw new ErroNegocio(503, 'HELENA_INDISPONIVEL', 'Não foi possível validar seu acesso agora. Tente novamente');
        }
        throw err;
      }
      if (!agente) throw new ErroNegocio(403, 'AGENTE_DESCONHECIDO', 'Acesso não autorizado');
      if (cliente.alertaChatfast) await d.repo.atualizarCliente(cliente.id, { alertaChatfast: false });

      const admin = ehAdmin(cid, agente, d.adminCompanyids);
      const { token, exp } = d.emitir({ cid, uid: userId, nome: agente.nome, admin });
      return { token, expiraEm: new Date(exp).toISOString(), nome: agente.nome, admin, empresa: { nome: cliente.nome } };
    },
  };
}
