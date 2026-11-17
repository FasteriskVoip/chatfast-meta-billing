import axios, { isAxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import type { InfoToken, MetaGateway, NumeroMeta, PontoEnvio, PontoPreco } from '../../domain/ports/MetaGateway.js';
import { ErroIndisponivel, ErroLimite, ErroToken } from '../../domain/ports/erros.js';
import { BACKOFF_MS, CODIGOS_LIMITE, CODIGOS_TOKEN, deveRetentar } from '../../domain/sync/erros.js';
import { categoriaMeta, custo, qualidade, tipoPreco } from '../../domain/sync/normalizacao.js';

/** Único lugar que fala com graph.facebook.com. O JSON cru da Meta não sai daqui. */

const ESCOPO_OBRIGATORIO = 'whatsapp_business_management';
const LIMIAR_USO = 80;

interface Paginado<T> {
  data?: T[];
  paging?: { next?: string };
}

export interface OpcoesGateway {
  versao: string;
  http?: AxiosInstance;
  dormir?: (ms: number) => Promise<void>;
}

/** Erro da Graph → erro tipado do domínio. */
export function traduzirErroMeta(err: unknown): Error {
  if (!isAxiosError(err)) return err instanceof Error ? err : new Error(String(err));
  const e = (err.response?.data as { error?: { code?: number; type?: string; message?: string } } | undefined)?.error;
  const codigo = e?.code;
  if (codigo !== undefined && CODIGOS_TOKEN.has(codigo)) return new ErroToken(e?.message ?? 'token inválido', codigo);
  if (e?.type === 'OAuthException' && err.response?.status === 401) return new ErroToken(e.message ?? 'token inválido', codigo);
  if (codigo !== undefined && CODIGOS_LIMITE.has(codigo)) return new ErroLimite('limite da Meta', codigo);
  const status = err.response?.status;
  if (!err.response || (status !== undefined && status >= 500) || err.code === 'ECONNABORTED') {
    return new ErroIndisponivel('Meta indisponível');
  }
  return Object.assign(
    new Error(`Meta recusou a chamada (${status}${codigo ? `/${codigo}` : ''}): ${(e?.message ?? '').slice(0, 200)}`),
    { codigo },
  );
}

/** Maior percentual do cabeçalho X-Business-Use-Case-Usage. */
export function usoBuc(cabecalho: unknown): number {
  if (typeof cabecalho !== 'string') return 0;
  try {
    const porNegocio = JSON.parse(cabecalho) as Record<string, { call_count?: number; total_cputime?: number; total_time?: number }[]>;
    return Math.max(
      0,
      ...Object.values(porNegocio).flat().map((u) => Math.max(u.call_count ?? 0, u.total_cputime ?? 0, u.total_time ?? 0)),
    );
  } catch {
    return 0;
  }
}

export function criarMetaGateway(o: OpcoesGateway): MetaGateway {
  const http = o.http ?? axios.create();
  const dormir = o.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const base = `https://graph.facebook.com/${o.versao}`;
  let pertoDoLimite = false;

  async function get<T>(token: string, url: string, params?: Record<string, string>): Promise<T> {
    for (let tentativa = 0; ; tentativa++) {
      if (pertoDoLimite) await dormir(2000);
      try {
        const r: AxiosResponse<T> = await http.get<T>(url.startsWith('http') ? url : `${base}${url}`, {
          params,
          timeout: 20_000,
          // Token só no header: nunca na URL (que pode ir para log).
          headers: { Authorization: `Bearer ${token}` },
        });
        pertoDoLimite = usoBuc(r.headers?.['x-business-use-case-usage']) >= LIMIAR_USO;
        return r.data;
      } catch (err) {
        const erro = traduzirErroMeta(err);
        if (!deveRetentar(erro, tentativa)) throw erro;
        await dormir(BACKOFF_MS[tentativa]!);
      }
    }
  }

  async function todasPaginas<T>(token: string, url: string, params?: Record<string, string>): Promise<T[]> {
    const itens: T[] = [];
    let pagina = await get<Paginado<T>>(token, url, params);
    for (;;) {
      itens.push(...(pagina.data ?? []));
      const proxima = pagina.paging?.next;
      if (!proxima) return itens;
      // ponytail: o `next` da Meta pode trazer access_token na query; removemos e mandamos só no header.
      const limpa = new URL(proxima);
      limpa.searchParams.delete('access_token');
      pagina = await get<Paginado<T>>(token, limpa.toString());
    }
  }

  return {
    async validarToken(token) {
      // debug_token exige o token inspecionado na query (input_token); o log nunca grava query string.
      type Debug = { data?: { is_valid?: boolean; expires_at?: number; scopes?: string[]; error?: { message?: string } } };
      let r: Debug;
      try {
        r = await get<Debug>(token, '/debug_token', { input_token: token });
      } catch (err) {
        // #100: debug_token só aceita token de app ou de admin/dev do app. Token de outro app (System User do
        // cliente) cai aqui; /me/permissions valida o token e os escopos, mas não informa a expiração.
        if ((err as { codigo?: number }).codigo !== 100) throw err;
        const p = await get<{ data?: { permission: string; status: string }[] }>(token, '/me/permissions');
        r = { data: { is_valid: true, scopes: (p.data ?? []).filter((x) => x.status === 'granted').map((x) => x.permission) } };
      }
      const d = r.data ?? {};
      const escopos = d.scopes ?? [];
      const expiraEm = d.expires_at ? new Date(d.expires_at * 1000) : null;
      const info: InfoToken = { valido: Boolean(d.is_valid), expiraEm, escopos };
      if (!info.valido) info.motivo = d.error?.message ?? 'token inválido ou expirado';
      else if (expiraEm && expiraEm.getTime() <= Date.now()) {
        info.valido = false;
        info.motivo = 'token expirado';
      } else if (!escopos.includes(ESCOPO_OBRIGATORIO)) {
        info.valido = false;
        info.motivo = `escopo ausente: ${ESCOPO_OBRIGATORIO}`;
      }
      return info;
    },

    async obterWaba(token, wabaId) {
      const r = await get<{ name?: string; currency?: string; timezone_id?: string | number }>(
        token, `/${encodeURIComponent(wabaId)}`, { fields: 'name,currency,timezone_id' },
      );
      return {
        nome: r.name ?? wabaId,
        moeda: (r.currency ?? 'USD').toUpperCase(),
        fusoMeta: r.timezone_id === undefined ? null : String(r.timezone_id),
      };
    },

    async listarNumeros(token, wabaId) {
      const rs = await todasPaginas<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
        token, `/${encodeURIComponent(wabaId)}/phone_numbers`,
        { fields: 'id,display_phone_number,verified_name,quality_rating', limit: '100' },
      );
      return rs.map(
        (n): NumeroMeta => ({
          phoneNumberId: n.id,
          display: n.display_phone_number ?? n.id,
          verifiedName: n.verified_name ?? null,
          qualidade: qualidade(n.quality_rating),
        }),
      );
    },

    async pricingAnalytics(token, wabaId, inicioUnix, fimUnix) {
      const campo = (metricas: string) =>
        `pricing_analytics.start(${inicioUnix}).end(${fimUnix}).granularity(DAILY)${metricas}` +
        '.dimensions(PHONE,PRICING_CATEGORY,PRICING_TYPE,COUNTRY,TIER)';
      type Ponto = {
        start: number; phone_number?: string; phone?: string; country?: string; pricing_category?: string;
        pricing_type?: string; tier?: string; volume?: number; cost?: number | string | null;
      };
      type Resp = { pricing_analytics?: Paginado<{ data_points?: Ponto[] }> };
      const url = `/${encodeURIComponent(wabaId)}`;
      // Sem metric_types a Meta só devolve volume. WABA cobrada via parceiro recusa COST (#10): fica sem custo (null).
      const r = await get<Resp>(token, url, { fields: campo('.metric_types(["COST","VOLUME"])') }).catch((err: unknown) => {
        if ((err as { codigo?: number }).codigo !== 10) throw err;
        return get<Resp>(token, url, { fields: campo('') });
      });
      const blocos = [...(r.pricing_analytics?.data ?? [])];
      // Paginação defensiva: a doc não mostra `paging` aqui, mas quebras grandes podem paginar.
      let proxima = r.pricing_analytics?.paging?.next;
      while (proxima) {
        const limpa = new URL(proxima);
        limpa.searchParams.delete('access_token');
        const p = await get<Paginado<{ data_points?: Ponto[] }>>(token, limpa.toString());
        blocos.push(...(p.data ?? []));
        proxima = p.paging?.next;
      }
      return blocos.flatMap((b) => b.data_points ?? []).map(
        (p): PontoPreco => ({
          inicioUnix: p.start,
          // R-01: a chave do número com a dimensão PHONE não está confirmada; aceitamos as duas.
          telefone: p.phone_number ?? p.phone ?? null,
          pais: (p.country ?? '').slice(0, 2).toUpperCase(),
          categoria: categoriaMeta(p.pricing_category),
          tipoPreco: tipoPreco(p.pricing_type),
          tier: p.tier ?? '',
          volume: Number(p.volume ?? 0),
          custo: custo(p.cost),
        }),
      );
    },

    async analytics(token, wabaId, telefone, inicioUnix, fimUnix) {
      const campo =
        `analytics.start(${inicioUnix}).end(${fimUnix}).granularity(DAY)` +
        `.phone_numbers(${JSON.stringify([telefone.replace(/\D/g, '')])})`;
      const r = await get<{ analytics?: { data_points?: { start: number; sent?: number; delivered?: number }[] } }>(
        token, `/${encodeURIComponent(wabaId)}`, { fields: campo },
      );
      return (r.analytics?.data_points ?? []).map(
        (p): PontoEnvio => ({ inicioUnix: p.start, enviadas: Number(p.sent ?? 0), entregues: Number(p.delivered ?? 0) }),
      );
    },
  };
}
