import { describe, expect, it, vi } from 'vitest';
import type { MetaGateway, PontoPreco } from '../../server/domain/ports/MetaGateway.js';
import { ErroToken } from '../../server/domain/ports/erros.js';
import { criarSyncService } from '../../server/services/sync.service.js';
import { CID_A, CID_B, ConsumoMemoria, RepoMemoria, cifraFake, silencioso } from '../fakes.js';
import { metaFake } from '../app.helper.js';

// 2025-11-12 00:00 em Fortaleza
const DIA = Date.UTC(2025, 10, 12, 3) / 1000;
const AGORA = new Date('2025-11-13T12:00:00Z');

const ponto = (p: Partial<PontoPreco>): PontoPreco => ({
  inicioUnix: DIA, telefone: '556133993888', pais: 'BR', categoria: 'MARKETING', tipoPreco: 'REGULAR', tier: '', volume: 10,
  custo: '1.000000', ...p,
});

function montar(meta: MetaGateway) {
  const repo = new RepoMemoria();
  repo.lockAgora = () => AGORA.getTime();
  const consumo = new ConsumoMemoria();
  const cliente = repo.addCliente({ companyid: CID_A });
  const conta = repo.addConta(cliente, { historicoDesde: null });
  const n1 = repo.addNumero(conta, { phoneNumberId: 'p1', display: '+55 61 3399-3888' });
  const svc = criarSyncService({
    repo, consumo, meta, cifra: cifraFake, log: silencioso, serializarErro: (e) => ({ e: String(e) }),
    cfg: { diasBackfill: 3, diasReprocesso: 2 }, agora: () => AGORA, heartbeat: vi.fn(async () => {}),
  });
  return { repo, consumo, cliente, conta, n1, svc };
}

const metaPadrao = (over: Partial<MetaGateway> = {}) =>
  metaFake({
    listarNumeros: vi.fn(async () => [{ phoneNumberId: 'p1', display: '+55 61 3399-3888', verifiedName: 'X', qualidade: 'GREEN' as const }]),
    pricingAnalytics: vi.fn(async () => [ponto({}), ponto({ categoria: 'SERVICE', tipoPreco: 'FREE_CUSTOMER_SERVICE', custo: '0.000000' })]),
    analytics: vi.fn(async () => [{ inicioUnix: DIA, enviadas: 12, entregues: 11 }]),
    ...over,
  });

describe('sync.service.sincronizarConta', () => {
  it('sucesso: upsert, status ATIVA, historicoDesde, execução OK com linhas e o token decifrado', async () => {
    const meta = metaPadrao();
    const { repo, consumo, conta, svc } = montar(meta);
    repo.contas[0]!.status = 'ERRO_SYNC';
    repo.contas[0]!.desatualizadoDesde = new Date('2025-11-01');
    expect(await svc.sincronizarConta(conta.id, 'CICLO')).toBe('OK');
    expect(consumo.consumo.size).toBe(2);
    expect([...consumo.mensagens.values()][0]).toMatchObject({ data: '2025-11-12', enviadas: 12, entregues: 11 });
    expect(repo.contas[0]).toMatchObject({ status: 'ATIVA', ultimoErro: null, desatualizadoDesde: null, historicoDesde: '2025-11-11', syncEmAndamentoDesde: null });
    expect(repo.execucoes[0]).toMatchObject({ status: 'OK', linhas: 3, origem: 'CICLO', janelaDe: '2025-11-11', janelaAte: '2025-11-13' });
    expect(meta.pricingAnalytics).toHaveBeenCalledWith('EAAG-meta-token-9999', conta.wabaId, expect.any(Number), expect.any(Number));
  });

  it('idempotente: dois syncs iguais → mesmos fatos', async () => {
    const { consumo, conta, svc } = montar(metaPadrao());
    await svc.sincronizarConta(conta.id, 'CICLO');
    const antes = JSON.stringify([...consumo.consumo.values()]);
    await svc.sincronizarConta(conta.id, 'CICLO');
    expect(JSON.stringify([...consumo.consumo.values()])).toBe(antes);
  });

  it('lock ocupado → IGNORADA, sem chamar a Meta', async () => {
    const meta = metaPadrao();
    const { repo, conta, svc } = montar(meta);
    repo.contas[0]!.syncEmAndamentoDesde = new Date(AGORA.getTime() - 60_000);
    expect(await svc.sincronizarConta(conta.id, 'CLIENTE')).toBe('IGNORADA');
    expect(meta.listarNumeros).not.toHaveBeenCalled();
    expect(repo.execucoes[0]!.status).toBe('IGNORADA');
  });

  it('erro 190 → TOKEN_INVALIDO, desatualizadoDesde, execução ERRO e lock liberado', async () => {
    const meta = metaPadrao({ listarNumeros: vi.fn(async () => { throw new ErroToken('expirado', 190); }) });
    const { repo, conta, svc } = montar(meta);
    expect(await svc.sincronizarConta(conta.id, 'CICLO')).toBe('ERRO');
    expect(repo.contas[0]).toMatchObject({ status: 'TOKEN_INVALIDO', desatualizadoDesde: AGORA, syncEmAndamentoDesde: null });
    expect(repo.contas[0]!.ultimoErro).toContain('Token inválido');
    expect(repo.execucoes[0]!.status).toBe('ERRO');
  });

  it('volume sem custo em todos os pontos → sem_custo_meta', async () => {
    const meta = metaPadrao({ pricingAnalytics: vi.fn(async () => [ponto({ custo: null }), ponto({ categoria: 'UTILITY', custo: null })]) });
    const { repo, conta, svc } = montar(meta);
    await svc.sincronizarConta(conta.id, 'CICLO');
    expect(repo.contas[0]!.semCustoMeta).toBe(true);
  });

  it('número com coleta desativada não é coletado; número novo é criado; sumido é marcado', async () => {
    const meta = metaPadrao({
      listarNumeros: vi.fn(async () => [
        { phoneNumberId: 'p1', display: '+55 61 3399-3888', verifiedName: 'X', qualidade: 'GREEN' as const },
        { phoneNumberId: 'p3', display: '+55 11 9999-0000', verifiedName: 'Novo', qualidade: 'YELLOW' as const },
      ]),
    });
    const { repo, consumo, conta, n1, svc } = montar(meta);
    repo.addNumero(conta, { phoneNumberId: 'p2', display: '+55 85 4000-0000' });
    n1.coletaAtiva = false;
    await svc.sincronizarConta(conta.id, 'CICLO');
    expect(consumo.consumo.size).toBe(0);
    expect(meta.analytics).toHaveBeenCalledTimes(1);
    expect(repo.numeros.find((n) => n.phoneNumberId === 'p3')).toBeTruthy();
    expect(repo.numeros.find((n) => n.phoneNumberId === 'p2')!.naoEncontradoNaMeta).toBe(true);
  });
});

describe('sync.service.executarTick', () => {
  it('erro na conta A não impede a conta B; pausada e cliente inativo ficam fora', async () => {
    const meta = metaPadrao({
      listarNumeros: vi.fn(async (_t: string, waba: string) => {
        if (waba === 'A') throw new Error('falha');
        return [];
      }),
    });
    const { repo, svc } = montar(meta);
    repo.contas.length = 0;
    const c1 = repo.clientes[0]!;
    const a = repo.addConta(c1, { wabaId: 'A' });
    const b = repo.addConta(c1, { wabaId: 'B' });
    repo.addConta(c1, { wabaId: 'P', status: 'PAUSADA' });
    const inativo = repo.addCliente({ companyid: CID_B, status: 'INATIVO' });
    repo.addConta(inativo, { wabaId: 'I' });
    await svc.executarTick();
    expect(repo.contas.find((c) => c.id === a.id)!.status).toBe('ERRO_SYNC');
    expect(repo.contas.find((c) => c.id === b.id)!.status).toBe('ATIVA');
    expect((meta.listarNumeros as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1])).toEqual(['A', 'B']);
  });
});
