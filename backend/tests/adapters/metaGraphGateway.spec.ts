import { readFileSync } from 'node:fs';
import { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { criarMetaGateway, usoBuc } from '../../server/adapters/meta/metaGraphGateway.js';
import { ErroLimite, ErroToken } from '../../server/domain/ports/erros.js';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/meta/${n}.json`, import.meta.url), 'utf8'));
const TOKEN = 'EAAG-segredo-123456';

type Resp = { data: unknown; headers?: Record<string, string> } | { erro: unknown; status: number };

/** axios falso: responde em ordem e registra as chamadas. */
function http(respostas: Resp[]) {
  const chamadas: { url: string; params?: Record<string, string>; headers: Record<string, string> }[] = [];
  const get = vi.fn(async (url: string, cfg: { params?: Record<string, string>; headers: Record<string, string> }) => {
    chamadas.push({ url, params: cfg.params, headers: cfg.headers });
    const r = respostas.shift();
    if (!r) throw new Error('sem resposta configurada');
    if ('erro' in r) {
      throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: r.status, data: r.erro, headers: {}, statusText: '', config: { headers: new AxiosHeaders() },
      });
    }
    return { data: r.data, headers: r.headers ?? {} };
  });
  return { inst: { get } as unknown as AxiosInstance, chamadas };
}

const dormir = vi.fn(async (_ms: number) => {});
const gw = (respostas: Resp[]) => {
  const h = http(respostas);
  return { gw: criarMetaGateway({ versao: 'v27.0', http: h.inst, dormir }), ...h };
};

describe('metaGraphGateway', () => {
  it('token só no header Authorization, nunca na URL; segue paging.next sem access_token', async () => {
    const { gw: g, chamadas } = gw([{ data: fx('phone_numbers_p1') }, { data: fx('phone_numbers_p2') }]);
    const numeros = await g.listarNumeros(TOKEN, '102290129340398');
    expect(numeros).toEqual([
      { phoneNumberId: '106540352242922', display: '+55 61 3399-3888', verifiedName: 'Empresa Teste', qualidade: 'GREEN' },
      { phoneNumberId: '106540352242923', display: '+55 85 4000-0000', verifiedName: 'Suporte', qualidade: 'UNKNOWN' },
    ]);
    for (const c of chamadas) {
      expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.url).not.toContain(TOKEN);
      expect(c.url).not.toContain('access_token');
    }
    expect(chamadas[0]!.url).toBe('https://graph.facebook.com/v27.0/102290129340398/phone_numbers');
  });

  it('debug_token válido, System User (expires_at=0 → não expira)', async () => {
    const { gw: g } = gw([{ data: fx('debug_token_valido') }]);
    expect(await g.validarToken(TOKEN)).toMatchObject({ valido: true, expiraEm: null });
  });

  it('debug_token inválido traz o motivo', async () => {
    const { gw: g } = gw([{ data: fx('debug_token_expirado') }]);
    const info = await g.validarToken(TOKEN);
    expect(info.valido).toBe(false);
    expect(info.motivo).toContain('expired');
  });

  it('debug_token #100 (token de outro app) → valida por /me/permissions', async () => {
    const { gw: g, chamadas } = gw([
      { erro: { error: { code: 100, type: 'OAuthException', message: '(#100) You must provide an app access token' } }, status: 400 },
      { data: { data: [{ permission: 'whatsapp_business_management', status: 'granted' }] } },
    ]);
    expect(await g.validarToken(TOKEN)).toMatchObject({ valido: true, expiraEm: null });
    expect(chamadas[1]!.url).toBe('https://graph.facebook.com/v27.0/me/permissions');
  });

  it('sem whatsapp_business_management → inválido por escopo', async () => {
    const { gw: g } = gw([{ data: fx('debug_token_sem_escopo') }]);
    expect(await g.validarToken(TOKEN)).toMatchObject({ valido: false, motivo: 'escopo ausente: whatsapp_business_management' });
  });

  it('erro 190 → ErroToken sem retry', async () => {
    const { gw: g, chamadas } = gw([{ erro: fx('erro_190'), status: 400 }]);
    await expect(g.obterWaba(TOKEN, '1')).rejects.toBeInstanceOf(ErroToken);
    expect(chamadas).toHaveLength(1);
  });

  it('erro 80008 → backoff 2/4/8 s e desiste com ErroLimite', async () => {
    dormir.mockClear();
    const erro = { erro: fx('erro_80008'), status: 400 };
    const { gw: g, chamadas } = gw([erro, erro, erro, erro]);
    await expect(g.obterWaba(TOKEN, '1')).rejects.toBeInstanceOf(ErroLimite);
    expect(chamadas).toHaveLength(4);
    expect(dormir.mock.calls.map((c) => c[0])).toEqual([2000, 4000, 8000]);
  });

  it('erro 80008 seguido de sucesso → recupera', async () => {
    const { gw: g } = gw([{ erro: fx('erro_80008'), status: 400 }, { data: fx('waba') }]);
    expect(await g.obterWaba(TOKEN, '1')).toEqual({ nome: 'Empresa Teste', moeda: 'USD', fusoMeta: 'America/Fortaleza' });
  });

  it('X-Business-Use-Case-Usage ≥ 80% desacelera a próxima chamada', async () => {
    dormir.mockClear();
    const { gw: g } = gw([
      { data: fx('waba'), headers: { 'x-business-use-case-usage': JSON.stringify(fx('buc_85')) } },
      { data: fx('waba') },
    ]);
    await g.obterWaba(TOKEN, '1');
    expect(dormir).not.toHaveBeenCalled();
    await g.obterWaba(TOKEN, '1');
    expect(dormir).toHaveBeenCalledWith(2000);
  });

  it('usoBuc pega o maior percentual', () => {
    expect(usoBuc(JSON.stringify(fx('buc_85')))).toBe(85);
    expect(usoBuc(undefined)).toBe(0);
    expect(usoBuc('lixo')).toBe(0);
  });

  it('pricing_analytics: WABA de parceiro recusa COST (#10) → refaz só com volume, custo null', async () => {
    const { gw: g, chamadas } = gw([
      { erro: { error: { code: 10, error_subcode: 2388184, type: 'OAuthException', message: 'Application does not have permission for this action' } }, status: 400 },
      { data: { pricing_analytics: { data: [{ data_points: [{ start: 1, pricing_category: 'MARKETING', pricing_type: 'REGULAR', volume: 5 }] }] } } },
    ]);
    const pts = await g.pricingAnalytics(TOKEN, '1', 0, 1);
    expect(pts).toMatchObject([{ volume: 5, custo: null }]);
    expect(chamadas[1]!.params!.fields).not.toContain('metric_types');
  });

  it('pricing_analytics: normaliza categorias, custo ausente = null, aceita phone_number e phone', async () => {
    const { gw: g, chamadas } = gw([{ data: fx('pricing_analytics') }]);
    const pts = await g.pricingAnalytics(TOKEN, '102290129340398', 1762916400, 1763089200);
    expect(chamadas[0]!.params!.fields).toBe(
      'pricing_analytics.start(1762916400).end(1763089200).granularity(DAILY).metric_types(["COST","VOLUME"]).dimensions(PHONE,PRICING_CATEGORY,PRICING_TYPE,COUNTRY,TIER)',
    );
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual({
      inicioUnix: 1762916400, telefone: '556133993888', pais: 'BR', categoria: 'MARKETING', tipoPreco: 'REGULAR',
      tier: '0:MAX', volume: 120, custo: '7.500000',
    });
    expect(pts[1]!.categoria).toBe('MARKETING_LITE');
    expect(pts[3]).toMatchObject({ tipoPreco: 'FREE_CUSTOMER_SERVICE', custo: '0.000000', tier: '' });
    expect(pts[5]).toMatchObject({ telefone: '558540000000', custo: null });
    expect(pts[6]!.categoria).toBe('OUTRA');
  });

  it('analytics por número: granularidade DAY e telefone só com dígitos', async () => {
    const { gw: g, chamadas } = gw([{ data: fx('analytics') }]);
    const pts = await g.analytics(TOKEN, '1', '+55 61 3399-3888', 1, 2);
    expect(chamadas[0]!.params!.fields).toBe('analytics.start(1).end(2).granularity(DAY).phone_numbers(["556133993888"])');
    expect(pts[0]).toEqual({ inicioUnix: 1762916400, enviadas: 250, entregues: 245 });
  });
});
