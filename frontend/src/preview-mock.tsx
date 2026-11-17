// TEMPORÁRIO: preview visual com dados falsos. Apagar depois.
import axios from 'axios';
import { api } from '@/lib/api';
const dias = Array.from({ length: 17 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
const rnd = (i: number, b: number) => Math.round(b * (0.6 + 0.4 * Math.sin(i * 1.3) ** 2));
const resumo = {
  periodo: { de: '2026-11-01', ate: '2026-11-17', incluiHoje: true },
  envio: { enviadas: 48213, entregues: 46102, naoEntregues: 2111, taxaEntrega: 0.956, mediaDiaria: 2836.06, diasComEnvio: 17, diasNoPeriodo: 17, pico: { data: '2026-11-11', enviadas: 4420 } },
  categorias: [
    { categoria: 'MARKETING', volume: 21340, percentual: 0.46, cobradas: 21340, gratuitas: 0, custoBrl: '7342.18', custoSituacao: 'completo' },
    { categoria: 'UTILITY', volume: 12880, percentual: 0.28, cobradas: 11002, gratuitas: 1878, custoBrl: '512.40', custoSituacao: 'completo' },
    { categoria: 'AUTHENTICATION', volume: 3120, percentual: 0.07, cobradas: 3120, gratuitas: 0, custoBrl: '498.30', custoSituacao: 'parcial' },
    { categoria: 'SERVICE', volume: 8762, percentual: 0.19, cobradas: 0, gratuitas: 8762, custoBrl: '0', custoSituacao: 'completo' },
  ],
  total: { volume: 46102, categorias: 4, cobradas: 35462, custoBrl: '8352.88', custoMedioPorCobradaBrl: '0.2355', custoSituacao: 'parcial', diasSemCusto: 2, convertidoComCotacaoPosterior: false },
  serieCategorias: dias.map((d, i) => ({ data: d, MARKETING: { volume: rnd(i, 1500), custoBrl: String(rnd(i, 500)) }, UTILITY: { volume: rnd(i + 2, 800), custoBrl: '30' }, AUTHENTICATION: { volume: rnd(i + 4, 200), custoBrl: '29' }, SERVICE: { volume: rnd(i + 1, 520), custoBrl: '0' } })),
  serieMensagens: dias.map((d, i) => ({ data: d, enviadas: rnd(i, 3600), entregues: Math.round(rnd(i, 3600) * 0.95) })),
  porNumero: [
    { numeroId: 'n1', conta: 'Loja Principal', display: '+55 61 3399-3888', nomeVerificado: 'Loja Fasterisk', qualidade: 'GREEN', enviadas: 30110, entregues: 29001, taxaEntrega: 0.963, porCategoria: { MARKETING: 15000, UTILITY: 8000, AUTHENTICATION: 2000, SERVICE: 4001 }, custoBrl: '5822.10', percentualDoTotal: 0.63 },
    { numeroId: 'n2', conta: 'Loja Principal', display: '+55 61 3399-4000', nomeVerificado: null, qualidade: 'YELLOW', enviadas: 12003, entregues: 11201, taxaEntrega: 0.933, porCategoria: { MARKETING: 5000, UTILITY: 3880, AUTHENTICATION: 1120, SERVICE: 1201 }, custoBrl: '2012.78', percentualDoTotal: 0.25 },
    { numeroId: 'n3', conta: 'Suporte', display: '+55 11 4002-8922', nomeVerificado: 'Suporte Fast', qualidade: 'RED', enviadas: 6100, entregues: 5900, taxaEntrega: 0.967, porCategoria: { MARKETING: 1340, UTILITY: 1000, AUTHENTICATION: 0, SERVICE: 3560 }, custoBrl: '518.00', percentualDoTotal: 0.12 },
  ],
  ultimoSync: '2026-11-17T14:32:00Z',
};
const rotas: Record<string, unknown> = {
  '/sessao': { token: 't', expiraEm: '2099-01-01', nome: 'Ana', admin: false, empresa: { nome: 'Fasterisk Telecom' } },
  '/dashboard/filtros': { contas: [{ id: 'c1', nome: 'Loja Principal', wabaId: '1' }, { id: 'c2', nome: 'Suporte', wabaId: '2' }], numeros: [{ id: 'n1', contaId: 'c1', display: '+55 61 3399-3888', nomeVerificado: null }], categorias: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'], historicoDesde: '2026-01-01', fuso: 'America/Sao_Paulo' },
  '/dashboard/status': { ultimoSync: '2026-11-17T14:32:00Z', sincronizando: false, sincronizarDisponivelEm: null, desatualizadoDesde: null, coletandoHistorico: false },
  '/dashboard/resumo': resumo,
};
const adapter = async (cfg: any) => {
  const url = String(cfg.url).replace(/^\/api/, '');
  return { data: rotas[url] ?? {}, status: 200, statusText: 'OK', headers: {}, config: cfg };
};
axios.defaults.adapter = adapter as any;
api.defaults.adapter = adapter as any;
sessionStorage.clear();
history.replaceState(null, '', '/dashboard');
await import('./main');
