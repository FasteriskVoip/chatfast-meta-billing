import { chavePeriodo, excedeuLimite, type AlertaConsumo, type PeriodoAlerta } from '../domain/consumo/alertas.js';
import { hojeNoFuso } from '../domain/consumo/periodo.js';
import type { NotificadorAlertas } from '../domain/ports/NotificadorAlertas.js';
import type { ClienteRegistro, ContaRepository } from '../domain/ports/repositorios.js';
import { FUSO_PADRAO } from '../domain/sync/normalizacao.js';
import type { DashboardService } from './dashboard.service.js';

interface Log {
  info(o: object, msg: string): void;
  error(o: object, msg: string): void;
}

interface Deps {
  repo: Pick<ContaRepository, 'listarClientes' | 'contasDaEmpresa' | 'atualizarCliente' | 'clientePorId'>;
  dashboard: Pick<DashboardService, 'dadosResumo'>;
  /** null = N8N_WEBHOOK_ALERTAS vazio: os limites ficam salvos, mas nada é enviado. */
  notificador: NotificadorAlertas | null;
  log: Log;
  serializarErro: (err: unknown) => object;
  agora?: () => Date;
}

const CONFIG: Record<PeriodoAlerta, { limite: 'limiteDiarioBrl' | 'limiteMensalBrl'; marca: 'alertaDiarioEm' | 'alertaMensalEm'; evento: AlertaConsumo['evento'] }> = {
  diario: { limite: 'limiteDiarioBrl', marca: 'alertaDiarioEm', evento: 'consumo.limite_diario' },
  mensal: { limite: 'limiteMensalBrl', marca: 'alertaMensalEm', evento: 'consumo.limite_mensal' },
};

export type AlertasService = ReturnType<typeof criarAlertasService>;

/**
 * Roda depois de cada ciclo de coleta. Para cada cliente ativo com limite, compara o custo do dia e do
 * mês (no fuso da conta, mesmo cálculo do dashboard) e aciona o webhook uma vez por período.
 * Se o webhook falhar, não marca: tenta de novo no próximo ciclo.
 */
export function criarAlertasService(d: Deps) {
  const agora = d.agora ?? (() => new Date());

  async function verificarCliente(c: ClienteRegistro, notificador: NotificadorAlertas) {
    const contas = await d.repo.contasDaEmpresa(c.companyid);
    if (!contas.length) return;
    const hoje = hojeNoFuso(agora(), contas[0]?.fuso ?? FUSO_PADRAO);

    for (const periodo of ['diario', 'mensal'] as const) {
      const cfg = CONFIG[periodo];
      const limite = c[cfg.limite];
      const chave = chavePeriodo(periodo, hoje);
      if (limite === null || c[cfg.marca] === chave) continue;

      const { resumo } = await d.dashboard.dadosResumo(c.companyid, { de: chave, ate: hoje });
      const { custoBrl, custoSituacao } = resumo.total;
      if (!excedeuLimite(limite, custoBrl)) continue;

      const alerta: AlertaConsumo = {
        evento: cfg.evento,
        cliente: { id: c.id, nome: c.nome, companyid: c.companyid },
        periodo: { de: chave, ate: hoje },
        limiteBrl: limite,
        custoBrl: custoBrl!,
        situacaoCusto: custoSituacao,
        disparadoEm: agora().toISOString(),
      };
      await notificador.enviar(alerta);
      // Se o admin trocou o limite enquanto o alerta saía, o PATCH zerou a marca: não sobrescreve,
      // para o novo limite poder disparar. ponytail: releitura (janela de ms); update condicional se precisar fechar.
      const agoraCliente = await d.repo.clientePorId(c.id);
      if (agoraCliente?.[cfg.limite] === limite) await d.repo.atualizarCliente(c.id, { [cfg.marca]: chave });
      d.log.info({ companyid: c.companyid, evento: alerta.evento, custoBrl, limiteBrl: limite }, 'alerta de consumo enviado');
    }
  }

  return {
    async verificar() {
      if (!d.notificador) return;
      // Só clientes Taxi recebem alertas; os limites dos demais ficam guardados, sem efeito.
      const clientes = (await d.repo.listarClientes()).filter(
        (c) => c.taxi && c.status === 'ATIVO' && (c.limiteDiarioBrl !== null || c.limiteMensalBrl !== null),
      );
      // Um cliente com erro (webhook fora, consulta falhou) não impede os outros.
      for (const c of clientes) {
        await verificarCliente(c, d.notificador).catch((err: unknown) =>
          d.log.error({ companyid: c.companyid, err: d.serializarErro(err) }, 'alerta de consumo falhou'),
        );
      }
    },
  };
}
