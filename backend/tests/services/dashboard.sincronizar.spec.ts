import { describe, expect, it, vi } from 'vitest';
import { criarDashboardService } from '../../server/services/dashboard.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../fakes.js';

const AGORA = new Date('2026-11-17T12:00:00Z');
const minAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000);

function montar() {
  const repo = new RepoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const sync = { sincronizarConta: vi.fn(async () => 'OK' as const) };
  const svc = criarDashboardService({ repo, consumo: new ConsumoMemoria(), sync, emSegundoPlano: (p) => void p(), agora: () => AGORA });
  return { repo, cliente, sync, svc };
}

describe('dashboard.sincronizar (cliente)', () => {
  it('última sync há menos de 15 min → 429 SYNC_AGUARDE com disponivelEm', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { ultimoSyncEm: minAtras(5) });
    await expect(svc.sincronizar(CID_A)).rejects.toMatchObject({
      status: 429, codigo: 'SYNC_AGUARDE', extra: { disponivelEm: '2026-11-17T12:10:00.000Z' },
    });
  });

  it('coleta em andamento → 409 SYNC_EM_ANDAMENTO', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { ultimoSyncEm: minAtras(60), syncEmAndamentoDesde: minAtras(1) });
    await expect(svc.sincronizar(CID_A)).rejects.toMatchObject({ codigo: 'SYNC_EM_ANDAMENTO' });
  });

  it('dispara só contas liberadas e coletáveis, sem aguardar', async () => {
    const { repo, cliente, sync, svc } = montar();
    const ok = repo.addConta(cliente, { ultimoSyncEm: minAtras(20) });
    repo.addConta(cliente, { ultimoSyncEm: minAtras(5) });
    repo.addConta(cliente, { status: 'TOKEN_INVALIDO' });
    repo.addConta(cliente, { status: 'PAUSADA' });
    expect(await svc.sincronizar(CID_A)).toEqual({ iniciado: true });
    expect(sync.sincronizarConta).toHaveBeenCalledTimes(1);
    expect(sync.sincronizarConta).toHaveBeenCalledWith(ok.id, 'CLIENTE');
  });
});
