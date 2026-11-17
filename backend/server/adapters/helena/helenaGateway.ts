import axios, { isAxiosError, type AxiosInstance } from 'axios';
import type { Agente, HelenaGateway } from '../../domain/ports/HelenaGateway.js';
import { ErroIndisponivel, ErroToken } from '../../domain/ports/erros.js';

interface AgenteHelena {
  id: string;
  userId: string;
  name?: string | null;
  shortName?: string | null;
  isOwner?: boolean;
  profile?: string | null;
}

const paraAgente = (a: AgenteHelena): Agente => ({
  id: a.id,
  userId: a.userId,
  nome: a.name ?? a.shortName ?? '',
  isOwner: Boolean(a.isOwner),
  profile: a.profile ?? null,
});

function traduzir(err: unknown): never {
  if (isAxiosError(err)) {
    const s = err.response?.status;
    if (s === 401 || s === 403) throw new ErroToken('token Chatfast recusado pela Helena', s);
    throw new ErroIndisponivel('Helena indisponível');
  }
  throw err;
}

export function criarHelenaGateway(baseURL: string, http: AxiosInstance = axios.create()): HelenaGateway {
  const opts = (token: string) => ({ baseURL, timeout: 5000, headers: { Authorization: `Bearer ${token}` } });
  return {
    async obterAgente(token, id) {
      try {
        const r = await http.get<AgenteHelena>(`/core/v1/agent/${encodeURIComponent(id)}`, opts(token));
        return r.data?.id ? paraAgente(r.data) : null;
      } catch (err) {
        // 404/400: o id não é agente dessa conta (ou é userId): o service tenta a lista.
        if (isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 400)) return null;
        return traduzir(err);
      }
    },
    async listarAgentes(token) {
      try {
        const r = await http.get<AgenteHelena[]>('/core/v1/agent', opts(token));
        return (Array.isArray(r.data) ? r.data : []).map(paraAgente);
      } catch (err) {
        return traduzir(err);
      }
    },
  };
}
