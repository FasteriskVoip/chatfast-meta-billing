import { vi } from 'vitest';
import { criarApp } from '../server/adapters/http/app.js';
import { emitirSessao } from '../server/adapters/http/sessao.js';
import type { Agente, HelenaGateway } from '../server/domain/ports/HelenaGateway.js';
import type { MetaGateway } from '../server/domain/ports/MetaGateway.js';
import { criarClientesService } from '../server/services/clientes.service.js';
import { criarContasService } from '../server/services/contas.service.js';
import { criarCotacoesService } from '../server/services/cotacoes.service.js';
import { criarDashboardService } from '../server/services/dashboard.service.js';
import { criarExportacaoService } from '../server/services/exportacao.service.js';
import { criarSessaoService } from '../server/services/sessao.service.js';
import { CID_FASTERISK, ConsumoMemoria, RepoMemoria, cifraFake } from './fakes.js';

export const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

export function metaFake(over: Partial<MetaGateway> = {}): MetaGateway {
  return {
    validarToken: vi.fn(async () => ({ valido: true, expiraEm: null, escopos: ['whatsapp_business_management'] })),
    obterWaba: vi.fn(async () => ({ nome: 'WABA Meta', moeda: 'USD', fusoMeta: 'America/Fortaleza' })),
    listarNumeros: vi.fn(async () => []),
    pricingAnalytics: vi.fn(async () => []),
    analytics: vi.fn(async () => []),
    ...over,
  };
}

export function helenaFake(agentes: Agente[] = []): HelenaGateway {
  return {
    obterAgente: vi.fn(async (_t: string, id: string) => agentes.find((a) => a.id === id) ?? null),
    listarAgentes: vi.fn(async () => agentes),
  };
}

export const token = (cid: string, admin = false, uid = 'agente-1') =>
  emitirSessao({ cid, uid, nome: 'Agente', admin }, SEGREDO).token;

export const auth = (cid: string, admin = false) => ({ authorization: `Bearer ${token(cid, admin)}` });

export async function montarApp(o: {
  repo?: RepoMemoria;
  consumo?: ConsumoMemoria;
  meta?: MetaGateway;
  helena?: HelenaGateway;
  exigirEmbed?: boolean;
  exigirSessao?: boolean;
} = {}) {
  const repo = o.repo ?? new RepoMemoria();
  const consumo = o.consumo ?? new ConsumoMemoria();
  const meta = o.meta ?? metaFake();
  const helena = o.helena ?? helenaFake();
  const sync = { sincronizarConta: vi.fn(async () => 'OK' as const) };
  const emSegundoPlano = (p: () => Promise<unknown>) => void p();
  const dashboard = criarDashboardService({ repo, consumo, sync, emSegundoPlano });
  const clientes = criarClientesService({ repo, helena, cifra: cifraFake, sync, emSegundoPlano });
  const app = await criarApp({
    cfg: {
      exigirEmbed: o.exigirEmbed ?? false,
      exigirSessao: o.exigirSessao ?? true,
      origensEmbed: 'https://app.chatfast.chat https://web.helena.run',
      segredoSessao: SEGREDO,
    },
    repo,
    sessao: criarSessaoService({
      repo, helena, cifra: cifraFake, adminCompanyids: [CID_FASTERISK],
      emitir: (d) => emitirSessao(d, SEGREDO),
      cadastrarCliente: clientes.criar,
    }),
    dashboard,
    exportacao: criarExportacaoService({ dashboard, repo }),
    clientes,
    contas: criarContasService({ repo, meta, cifra: cifraFake, sync, emSegundoPlano }),
    cotacoes: criarCotacoesService({ repo }),
    saude: async () => {},
  });
  return { app, repo, consumo, meta, helena, sync };
}
