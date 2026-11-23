import { montarResumo, type NumeroInfo } from '../domain/consumo/agregacao.js';
import { diasEntre, hojeNoFuso } from '../domain/consumo/periodo.js';
import { aplicarPrecoFasterisk } from '../domain/consumo/precos.js';
import { ErroNegocio } from '../domain/ports/erros.js';
import type { ConsumoRepository, ContaRegistro, ContaRepository } from '../domain/ports/repositorios.js';
import { FUSO_PADRAO } from '../domain/sync/normalizacao.js';
import { STATUS_PROBLEMA, coletavel } from '../domain/sync/status.js';
import { GRUPOS, type DataISO, type Grupo } from '../domain/tipos.js';
import { emAndamento } from './contas.service.js';
import type { SyncService } from './sync.service.js';

export const INTERVALO_SYNC_CLIENTE_MS = 15 * 60 * 1000;
export const MAX_DIAS_PERIODO = 366;

export interface FiltrosDashboard {
  de: DataISO;
  ate: DataISO;
  contaId?: string;
  numeroId?: string;
  categoria?: Grupo;
  /** Só admin (a rota descarta para os demais): cliente Taxi com o custo da Meta no lugar do preço Fasterisk. */
  custo?: 'meta';
}

interface Deps {
  repo: ContaRepository;
  consumo: ConsumoRepository;
  sync: Pick<SyncService, 'sincronizarConta'>;
  emSegundoPlano: (p: () => Promise<unknown>) => void;
  agora?: () => Date;
}

export type DashboardService = ReturnType<typeof criarDashboardService>;

const maisRecente = (ds: (Date | null)[]) => {
  const ts = ds.filter((x): x is Date => x !== null).map((x) => x.getTime());
  return ts.length ? new Date(Math.max(...ts)) : null;
};

export function criarDashboardService(d: Deps) {
  const agora = d.agora ?? (() => new Date());
  const fusoDe = (contas: ContaRegistro[]) => contas[0]?.fuso ?? FUSO_PADRAO;

  function validarPeriodo(f: FiltrosDashboard) {
    if (f.de > f.ate) throw new ErroNegocio(400, 'VALIDACAO', 'de: a data inicial deve ser anterior ou igual à final');
    if (diasEntre(f.de, f.ate) + 1 > MAX_DIAS_PERIODO) {
      throw new ErroNegocio(400, 'VALIDACAO', `de: período máximo de ${MAX_DIAS_PERIODO} dias`);
    }
  }

  async function dadosResumo(companyid: string, f: FiltrosDashboard) {
    validarPeriodo(f);
    const [cliente, grupos, contas, numeros, cotacoes, consumoMeta, mensagens] = await Promise.all([
      d.repo.clientePorCompanyid(companyid),
      d.repo.listarGruposCusto(),
      d.repo.contasDaEmpresa(companyid),
      d.repo.numerosDaEmpresa(companyid),
      d.repo.listarCotacoes(),
      d.consumo.consumoAgregado({ companyid, de: f.de, ate: f.ate, contaId: f.contaId, numeroId: f.numeroId }),
      d.consumo.mensagensAgregadas({ companyid, de: f.de, ate: f.ate, contaId: f.contaId, numeroId: f.numeroId }),
    ]);
    const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
    const infos: NumeroInfo[] = numeros
      .filter((n) => (!f.contaId || n.contaWabaId === f.contaId) && (!f.numeroId || n.id === f.numeroId))
      .map((n) => ({
        id: n.id, conta: nomeConta.get(n.contaWabaId) ?? '', display: n.display, nomeVerificado: n.verifiedName, qualidade: n.qualidade,
      }));
    // Cliente Taxi vê o preço do grupo Fasterisk; resumoMeta guarda o custo da Meta (o que a Fasterisk paga).
    const grupoTaxi = cliente?.taxi ? grupos.find((g) => g.id === cliente.grupoCustoId) ?? null : null;
    const grupo = f.custo === 'meta' ? null : grupoTaxi;
    const consumo = grupo ? aplicarPrecoFasterisk(consumoMeta, grupo.precoBrl) : consumoMeta;
    const base = { de: f.de, ate: f.ate, hoje: hojeNoFuso(agora(), fusoDe(contas)), grupo: f.categoria, mensagens, numeros: infos, cotacoes };
    const resumoMeta = montarResumo({ ...base, consumo: consumoMeta });
    const resumo = grupo ? montarResumo({ ...base, consumo }) : resumoMeta;
    // fasterisk = o cliente é Taxi (a tela do admin mostra o botão Fasterisk/Meta); custo = qual valor o resumo traz.
    const fasterisk = grupoTaxi && { grupo: grupoTaxi.nome, precoBrl: grupoTaxi.precoBrl };
    const custo: 'fasterisk' | 'meta' = grupo ? 'fasterisk' : 'meta';
    return { resumo, resumoMeta, fasterisk, custo, contas, consumo, cotacoes, infos, ultimoSync: maisRecente(contas.map((c) => c.ultimoSyncEm)) };
  }

  return {
    dadosResumo,

    async resumo(companyid: string, f: FiltrosDashboard) {
      const { resumo, fasterisk, custo, ultimoSync } = await dadosResumo(companyid, f);
      return { ...resumo, ultimoSync, fasterisk, custo };
    },

    async filtros(companyid: string) {
      const [contas, numeros] = await Promise.all([d.repo.contasDaEmpresa(companyid), d.repo.numerosDaEmpresa(companyid)]);
      const historicos = contas.map((c) => c.historicoDesde).filter((x): x is string => x !== null).sort();
      return {
        contas: contas.map((c) => ({ id: c.id, nome: c.nome, wabaId: c.wabaId })),
        numeros: numeros.map((n) => ({ id: n.id, contaId: n.contaWabaId, display: n.display, nomeVerificado: n.verifiedName })),
        categorias: [...GRUPOS],
        historicoDesde: historicos[0] ?? null,
        fuso: fusoDe(contas),
      };
    },

    async status(companyid: string) {
      const contas = await d.repo.contasDaEmpresa(companyid);
      const agoraMs = agora().getTime();
      const problemas = contas.filter((c) => STATUS_PROBLEMA.has(c.status));
      const desde = problemas
        .map((c) => c.ultimoSyncEm ?? c.desatualizadoDesde)
        .filter((x): x is Date => x !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const ativas = contas.filter((c) => c.status !== 'PAUSADA' && c.status !== 'TOKEN_INVALIDO');
      const liberadas = ativas.map((c) => (c.ultimoSyncEm?.getTime() ?? 0) + INTERVALO_SYNC_CLIENTE_MS);
      const proxima = liberadas.length && liberadas.every((t) => t > agoraMs) ? Math.min(...liberadas) : null;
      return {
        ultimoSync: maisRecente(contas.map((c) => c.ultimoSyncEm)),
        sincronizando: contas.some((c) => emAndamento(c, agoraMs)),
        sincronizarDisponivelEm: proxima ? new Date(proxima) : null,
        desatualizadoDesde: desde ?? (problemas.length ? agora() : null),
        coletandoHistorico: contas.some((c) => c.historicoDesde === null && c.status !== 'PAUSADA' && c.status !== 'TOKEN_INVALIDO'),
      };
    },

    /** Cliente: no máximo uma sincronização a cada 15 min por conta (FR-047). */
    async sincronizar(companyid: string) {
      const cliente = await d.repo.clientePorCompanyid(companyid);
      if (!cliente) throw new ErroNegocio(404, 'SEM_CADASTRO', 'Conta não cadastrada');
      const agoraMs = agora().getTime();
      const contas = (await d.repo.contasDaEmpresa(companyid)).filter((c) => coletavel(c, cliente));
      if (contas.length === 0) throw new ErroNegocio(409, 'SYNC_INDISPONIVEL', 'Nenhuma conta disponível para sincronizar');
      if (contas.every((c) => emAndamento(c, agoraMs))) {
        throw new ErroNegocio(409, 'SYNC_EM_ANDAMENTO', 'Já existe uma sincronização em andamento');
      }
      const liberadas = contas.filter((c) => !emAndamento(c, agoraMs) && (c.ultimoSyncEm?.getTime() ?? 0) + INTERVALO_SYNC_CLIENTE_MS <= agoraMs);
      if (liberadas.length === 0) {
        const disponivelEm = new Date(Math.min(...contas.map((c) => (c.ultimoSyncEm?.getTime() ?? 0) + INTERVALO_SYNC_CLIENTE_MS)));
        throw new ErroNegocio(429, 'SYNC_AGUARDE', 'Aguarde para sincronizar novamente', { disponivelEm: disponivelEm.toISOString() });
      }
      for (const c of liberadas) d.emSegundoPlano(() => d.sync.sincronizarConta(c.id, 'CLIENTE'));
      return { iniciado: true };
    },
  };
}
