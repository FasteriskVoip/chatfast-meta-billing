import { describe, expect, it, vi } from 'vitest';
import type { AlertaConsumo } from '../../server/domain/consumo/alertas.js';
import { criarAlertasService } from '../../server/services/alertas.service.js';
import { CID_A, RepoMemoria } from '../fakes.js';

const CID_B = '22222222-2222-4222-8222-222222222222';
// 2026-11-18 12:00 em Fortaleza
const AGORA = new Date('2026-11-18T15:00:00Z');

/** custos[companyid][de] = custo em R$ do período que começa em `de` (o dia, ou o 1º do mês). */
function montar(custos: Record<string, Record<string, string | null>>, o: { enviar?: () => Promise<void>; webhook?: boolean } = {}) {
  const repo = new RepoMemoria();
  const enviados: AlertaConsumo[] = [];
  const enviar = vi.fn(o.enviar ?? (async () => {}));
  const log = { info: vi.fn(), error: vi.fn() };
  const dashboard = {
    dadosResumo: vi.fn(async (cid: string, f: { de: string }) => {
      const custo = custos[cid]?.[f.de] ?? null;
      return { resumo: { total: { custoBrl: custo, custoSituacao: custo === null ? 'indisponivel' : 'completo' } } };
    }),
  };
  const svc = criarAlertasService({
    repo, log, serializarErro: (e) => ({ e: String(e) }), agora: () => AGORA,
    dashboard: dashboard as never,
    notificador: o.webhook === false ? null : { enviar: async (a) => { await enviar(); enviados.push(a); } },
  });
  return { svc, repo, enviados, log, dashboard };
}

describe('alertas.service.verificar', () => {
  it('passou do limite diário: envia uma vez no dia e marca', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '231.45' } });
    const c = m.repo.addCliente({ taxi: true, limiteDiarioBrl: '200.00' });
    m.repo.addConta(c);
    await m.svc.verificar();
    await m.svc.verificar();
    expect(m.enviados).toHaveLength(1);
    expect(m.enviados[0]).toMatchObject({
      evento: 'consumo.limite_diario', cliente: { id: c.id, companyid: CID_A }, periodo: { de: '2026-11-18', ate: '2026-11-18' },
      limiteBrl: '200.00', custoBrl: '231.45', situacaoCusto: 'completo',
    });
    expect(m.repo.clientes[0]!.alertaDiarioEm).toBe('2026-11-18');
  });

  it('limite mensal olha do dia 1 até hoje', async () => {
    const m = montar({ [CID_A]: { '2026-11-01': '3100.00' } });
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteMensalBrl: '3000.00' }));
    await m.svc.verificar();
    expect(m.enviados[0]).toMatchObject({ evento: 'consumo.limite_mensal', periodo: { de: '2026-11-01', ate: '2026-11-18' } });
    expect(m.repo.clientes[0]!.alertaMensalEm).toBe('2026-11-01');
  });

  it('enviado ontem: envia de novo hoje', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '500.00' } });
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteDiarioBrl: '200.00', alertaDiarioEm: '2026-11-17' }));
    await m.svc.verificar();
    expect(m.enviados).toHaveLength(1);
  });

  it('abaixo do limite, custo ausente, cliente inativo ou sem conta: nada sai', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '199.00' }, [CID_B]: { '2026-11-18': null } });
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteDiarioBrl: '200.00' }));
    m.repo.addConta(m.repo.addCliente({ taxi: true, companyid: CID_B, limiteDiarioBrl: '1.00' }));
    m.repo.addConta(m.repo.addCliente({ taxi: true, companyid: '33333333-3333-4333-8333-333333333333', status: 'INATIVO', limiteDiarioBrl: '1.00' }));
    m.repo.addCliente({ taxi: true, companyid: '44444444-4444-4444-8444-444444444444', limiteDiarioBrl: '1.00' });
    await m.svc.verificar();
    expect(m.enviados).toHaveLength(0);
  });

  it('webhook falhou: não marca (tenta no próximo ciclo) e não trava os outros clientes', async () => {
    let falhar = true;
    const m = montar(
      { [CID_A]: { '2026-11-18': '300.00' }, [CID_B]: { '2026-11-18': '300.00' } },
      { enviar: async () => { if (falhar) { falhar = false; throw new Error('n8n fora'); } } },
    );
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteDiarioBrl: '200.00' }));
    m.repo.addConta(m.repo.addCliente({ taxi: true, companyid: CID_B, limiteDiarioBrl: '200.00' }));
    await m.svc.verificar();
    expect(m.log.error).toHaveBeenCalledTimes(1);
    expect(m.repo.clientes[0]!.alertaDiarioEm).toBeNull();
    expect(m.repo.clientes[1]!.alertaDiarioEm).toBe('2026-11-18');
    await m.svc.verificar();
    expect(m.repo.clientes[0]!.alertaDiarioEm).toBe('2026-11-18');
  });

  it('cliente que não é Taxi não recebe alerta, mesmo acima do limite', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '999.00' } });
    m.repo.addConta(m.repo.addCliente({ limiteDiarioBrl: '1.00' }));
    await m.svc.verificar();
    expect(m.enviados).toHaveLength(0);
    expect(m.dashboard.dadosResumo).not.toHaveBeenCalled();
  });

  it('admin trocou o limite enquanto o alerta saía: não marca, o novo limite ainda pode disparar', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '300.00' } }, {
      enviar: async () => {
        m.repo.clientes[0]!.limiteDiarioBrl = '500.00';
        m.repo.clientes[0]!.alertaDiarioEm = null;
      },
    });
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteDiarioBrl: '200.00' }));
    await m.svc.verificar();
    expect(m.repo.clientes[0]!.alertaDiarioEm).toBeNull();
  });

  it('sem webhook configurado: não consulta nada', async () => {
    const m = montar({ [CID_A]: { '2026-11-18': '999.00' } }, { webhook: false });
    m.repo.addConta(m.repo.addCliente({ taxi: true, limiteDiarioBrl: '1.00' }));
    await m.svc.verificar();
    expect(m.dashboard.dadosResumo).not.toHaveBeenCalled();
  });
});
