import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** ÚNICO acesso à API. Mesma origem: o Fastify serve /api e o front. */
export const API_URL = '/api';
export const api = axios.create({ baseURL: API_URL });

const params = () => new URLSearchParams(window.location.search);
const primeiro = (chaves: string[]) => chaves.map((k) => params().get(k)).find((v) => v && v.trim()) ?? undefined;

/** O Chatfast varia o nome dos parâmetros do embed. */
export const companyidDaUrl = () => primeiro(['company_id', 'companyid', 'companyId']);
export const userIdDaUrl = () => primeiro(['user_id', 'userId', 'userid', 'user']);

export interface SessaoAberta {
  token: string;
  expiraEm: string;
  nome: string;
  admin: boolean;
  empresa: { nome: string };
}

export interface ErroApi {
  error: string;
  codigo?: string;
  traceId?: string;
  disponivelEm?: string;
}

export async function abrirSessao(): Promise<SessaoAberta> {
  const { data } = await axios.post<SessaoAberta>(`${API_URL}/sessao`, {
    companyid: companyidDaUrl(),
    user_id: userIdDaUrl(),
  });
  api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
  return data;
}

// Uma renovação compartilhada: várias requisições com 401 esperam a mesma promessa.
let renovando: Promise<SessaoAberta> | null = null;

api.interceptors.response.use(undefined, async (err: AxiosError<ErroApi>) => {
  const cfg = err.config as (InternalAxiosRequestConfig & { _renovada?: boolean }) | undefined;
  if (err.response?.status === 401 && err.response.data?.codigo === 'SESSAO_INVALIDA' && cfg && !cfg._renovada) {
    cfg._renovada = true;
    renovando ??= abrirSessao().finally(() => (renovando = null));
    const s = await renovando;
    cfg.headers.Authorization = `Bearer ${s.token}`;
    return api(cfg);
  }
  if (err.response && err.response.status >= 500 && err.response.data?.traceId) {
    err.response.data.error = `${err.response.data.error} (código: ${err.response.data.traceId})`;
  }
  return Promise.reject(err);
});

/** Mensagem amigável de qualquer erro da API. */
export function mensagemDeErro(err: unknown): string {
  if (axios.isAxiosError<ErroApi>(err)) return err.response?.data?.error ?? 'Não foi possível falar com o servidor';
  return 'Erro inesperado';
}

export const codigoDeErro = (err: unknown) => (axios.isAxiosError<ErroApi>(err) ? err.response?.data?.codigo : undefined);
