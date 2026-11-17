import { describe, expect, it } from 'vitest';
import { criarDashboardService } from '../../server/services/dashboard.service.js';
import { CID_A, ConsumoMemoria, RepoMemoria } from '../fakes.js';

const AGORA = new Date('2026-11-17T12:00:00Z');

function montar() {
  const repo = new RepoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const svc = criarDashboardService({
    repo, consumo: new ConsumoMemoria(), sync: { sincronizarConta: async () => 'OK' }, emSegundoPlano: () => {}, agora: () => AGORA,
  });
  return { repo, cliente, svc };
}

describe('dashboard.status', () => {
  it('desatualizadoDesde = sync mais antigo entre as contas com problema', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { status: 'TOKEN_INVALIDO', ultimoSyncEm: new Date('2026-11-10T10:00:00Z') });
    repo.addConta(cliente, { status: 'ERRO_SYNC', ultimoSyncEm: new Date('2026-11-12T10:00:00Z') });
    repo.addConta(cliente, { status: 'ATIVA', ultimoSyncEm: new Date('2026-11-17T11:00:00Z') });
    const s = await svc.status(CID_A);
    expect(s.desatualizadoDesde).toEqual(new Date('2026-11-10T10:00:00Z'));
    expect(s.ultimoSync).toEqual(new Date('2026-11-17T11:00:00Z'));
  });

  it('todas ATIVA/TOKEN_EXPIRANDO → sem faixa', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { status: 'ATIVA', ultimoSyncEm: new Date('2026-11-17T08:00:00Z') });
    repo.addConta(cliente, { status: 'TOKEN_EXPIRANDO', ultimoSyncEm: new Date('2026-11-17T08:00:00Z') });
    expect((await svc.status(CID_A)).desatualizadoDesde).toBeNull();
  });

  it('coletando histórico e botão bloqueado', async () => {
    const { repo, cliente, svc } = montar();
    repo.addConta(cliente, { historicoDesde: null, ultimoSyncEm: new Date('2026-11-17T11:55:00Z') });
    const s = await svc.status(CID_A);
    expect(s.coletandoHistorico).toBe(true);
    expect(s.sincronizarDisponivelEm).toEqual(new Date('2026-11-17T12:10:00Z'));
  });
});
