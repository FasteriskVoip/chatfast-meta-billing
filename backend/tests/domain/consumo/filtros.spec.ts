import { describe, expect, it } from 'vitest';
import { criarDashboardService } from '../../../server/services/dashboard.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../../fakes.js';

// ConsumoMemoria grava de forma síncrona; o void não perde dados.
/** Filtros combinados (conta + número + categoria) aplicados a consumo, mensagens e séries. */
describe('filtros combinados', () => {
  const repo = new RepoMemoria();
  const consumo = new ConsumoMemoria();
  const cli = repo.addCliente({ companyid: CID_A });
  const c1 = repo.addConta(cli, { moeda: 'BRL' });
  const c2 = repo.addConta(cli, { moeda: 'BRL' });
  const n1 = repo.addNumero(c1);
  const n2 = repo.addNumero(c1, { display: '+55 85 4000-0000' });
  const n3 = repo.addNumero(c2, { display: '+55 11 0000-0000' });
  const base = { companyid: CID_A, data: '2026-11-02', tipoPreco: 'REGULAR' as const, pais: 'BR', tier: '', custo: '1.000000', moeda: 'BRL' };
  void consumo.upsertConsumo([
    { ...base, contaWabaId: c1.id, numeroId: n1.id, categoria: 'MARKETING', volume: 10 },
    { ...base, contaWabaId: c1.id, numeroId: n1.id, categoria: 'UTILITY', volume: 3 },
    { ...base, contaWabaId: c1.id, numeroId: n2.id, categoria: 'MARKETING', volume: 20 },
    { ...base, contaWabaId: c2.id, numeroId: n3.id, categoria: 'MARKETING', volume: 40 },
  ]);
  void consumo.upsertMensagens([
    { companyid: CID_A, contaWabaId: c1.id, numeroId: n1.id, data: '2026-11-02', enviadas: 13, entregues: 13 },
    { companyid: CID_A, contaWabaId: c2.id, numeroId: n3.id, data: '2026-11-02', enviadas: 40, entregues: 39 },
  ]);
  const svc = criarDashboardService({ repo, consumo, sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {} });
  const f = { de: '2026-11-01', ate: '2026-11-03' };

  it('sem filtro: tudo', async () => {
    const r = await svc.resumo(CID_A, f);
    expect(r.total.volume).toBe(73);
    expect(r.envio.enviadas).toBe(53);
    expect(r.porNumero).toHaveLength(3);
  });

  it('conta + número + categoria', async () => {
    const r = await svc.resumo(CID_A, { ...f, contaId: c1.id, numeroId: n1.id, categoria: 'MARKETING' });
    expect(r.total.volume).toBe(10);
    expect(r.envio.enviadas).toBe(13);
    expect(r.porNumero.map((n) => n.numeroId)).toEqual([n1.id]);
    expect(r.serieCategorias[1]!.MARKETING.volume).toBe(10);
    expect(r.serieCategorias[1]!.UTILITY.volume).toBe(0);
  });

  it('só conta', async () => {
    const r = await svc.resumo(CID_A, { ...f, contaId: c2.id });
    expect(r.total.volume).toBe(40);
    expect(r.porNumero.map((n) => n.numeroId)).toEqual([n3.id]);
  });

  it('de > ate e período acima de 366 dias são recusados', async () => {
    await expect(svc.resumo(CID_A, { de: '2026-11-03', ate: '2026-11-01' })).rejects.toMatchObject({ codigo: 'VALIDACAO' });
    await expect(svc.resumo(CID_A, { de: '2025-01-01', ate: '2026-11-01' })).rejects.toMatchObject({ codigo: 'VALIDACAO' });
  });
});
