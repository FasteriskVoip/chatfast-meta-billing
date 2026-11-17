import { trace, SpanStatusCode } from '@opentelemetry/api';
import { hojeNoFuso } from '../domain/consumo/periodo.js';
import type { Cifra } from '../domain/ports/Cifra.js';
import type { MetaGateway } from '../domain/ports/MetaGateway.js';
import type {
  ConsumoRepository, ContaRegistro, ContaRepository, LinhaConsumoNova, LinhaMensagensNova,
} from '../domain/ports/repositorios.js';
import { mensagemErro, statusPorErro } from '../domain/sync/erros.js';
import { calcularJanela } from '../domain/sync/janela.js';
import { dataNoFuso, fusoIana, soDigitos } from '../domain/sync/normalizacao.js';
import { aposErro, aposSucesso, coletavel, tokenExpirando } from '../domain/sync/status.js';
import { ErroToken } from '../domain/ports/erros.js';
import type { OrigemSync, StatusExecucao } from '../domain/tipos.js';

export interface Logger {
  info(o: object, msg?: string): void;
  warn(o: object, msg?: string): void;
  error(o: object, msg?: string): void;
}

interface Deps {
  repo: ContaRepository;
  consumo: ConsumoRepository;
  meta: MetaGateway;
  cifra: Cifra;
  cfg: { diasBackfill: number; diasReprocesso: number };
  log: Logger;
  serializarErro: (e: unknown) => object;
  /** pulso do monitor externo; `falhou` manda para /fail */
  heartbeat?: (falhou: boolean) => Promise<void>;
  agora?: () => Date;
}

export type SyncService = ReturnType<typeof criarSyncService>;

const tracer = trace.getTracer('consumo-meta');

export function criarSyncService(d: Deps) {
  const agora = d.agora ?? (() => new Date());

  async function coletar(contaSalva: ContaRegistro, janela: ReturnType<typeof calcularJanela>) {
    const token = d.cifra.decifrar(contaSalva.tokenCifrado);
    // Moeda/fuso sempre da Meta: o cadastro pode ter salvo valores padrão se a Meta recusou na hora.
    const waba = await d.meta.obterWaba(token, contaSalva.wabaId);
    const conta = { ...contaSalva, moeda: waba.moeda, fuso: fusoIana(waba.fusoMeta) };
    const numeros = await d.repo.sincronizarNumeros(conta, await d.meta.listarNumeros(token, conta.wabaId));
    const porTelefone = new Map(numeros.map((n) => [soDigitos(n.display), n]));
    const ativos = numeros.filter((n) => n.coletaAtiva && !n.naoEncontradoNaMeta);
    const coletar = new Set(ativos.map((n) => n.id));

    const precos = await d.meta.pricingAnalytics(token, conta.wabaId, janela.inicioUnix, janela.fimUnix);
    const linhas: LinhaConsumoNova[] = [];
    let semNumero = 0;
    for (const p of precos) {
      const n = porTelefone.get(soDigitos(p.telefone));
      if (!n) {
        semNumero++;
        continue;
      }
      if (!coletar.has(n.id)) continue;
      linhas.push({
        companyid: conta.companyid, contaWabaId: conta.id, numeroId: n.id, data: dataNoFuso(p.inicioUnix, conta.fuso),
        categoria: p.categoria, tipoPreco: p.tipoPreco, pais: p.pais, tier: p.tier, volume: p.volume, custo: p.custo,
        moeda: conta.moeda,
      });
    }
    if (semNumero > 0) d.log.warn({ contaId: conta.id, pontos: semNumero }, 'pontos de pricing sem número correspondente');

    // Linha de crédito de parceiro: a Meta manda volume sem custo (research R-12).
    const comVolume = linhas.filter((l) => l.volume > 0);
    const semCustoMeta = comVolume.length > 0 && comVolume.every((l) => l.custo === null);

    const mensagens: LinhaMensagensNova[] = [];
    for (const n of ativos) {
      for (const p of await d.meta.analytics(token, conta.wabaId, n.display, janela.inicioUnix, janela.fimUnix)) {
        mensagens.push({
          companyid: conta.companyid, contaWabaId: conta.id, numeroId: n.id,
          data: dataNoFuso(p.inicioUnix, conta.fuso), enviadas: p.enviadas, entregues: p.entregues,
        });
      }
    }

    const total = (await d.consumo.upsertConsumo(linhas)) + (await d.consumo.upsertMensagens(mensagens));
    return { total, semCustoMeta: comVolume.length > 0 ? semCustoMeta : conta.semCustoMeta, moeda: conta.moeda, fuso: conta.fuso };
  }

  async function sincronizarConta(contaId: string, origem: OrigemSync): Promise<StatusExecucao> {
    const conta = await d.repo.contaPorId(contaId);
    if (!conta) return 'IGNORADA';
    const cliente = await d.repo.clientePorId(conta.clienteId);
    if (!cliente) return 'IGNORADA';
    const janela = calcularJanela(conta, cliente, hojeNoFuso(agora(), conta.fuso), d.cfg);
    const base = { companyid: conta.companyid, contaWabaId: conta.id, origem, janelaDe: janela.de, janelaAte: janela.ate };

    if (!(await d.repo.adquirirLock(conta.id))) {
      const id = await d.repo.iniciarExecucao({ ...base, status: 'IGNORADA' });
      await d.repo.finalizarExecucao(id, { status: 'IGNORADA', linhas: 0, erro: 'sincronização já em andamento' });
      return 'IGNORADA';
    }

    return tracer.startActiveSpan('sync conta', async (span) => {
      span.setAttributes({ 'conta.id': conta.id, 'sync.origem': origem });
      const execId = await d.repo.iniciarExecucao({ ...base, status: 'EXECUTANDO' });
      try {
        const { total, semCustoMeta, moeda, fuso } = await coletar(conta, janela);
        const historicoDesde = conta.historicoDesde && conta.historicoDesde < janela.de ? conta.historicoDesde : janela.de;
        await d.repo.atualizarConta(conta.id, { ...aposSucesso(conta, agora()), semCustoMeta, historicoDesde, moeda, fuso });
        await d.repo.finalizarExecucao(execId, { status: 'OK', linhas: total, erro: null });
        return 'OK' as const;
      } catch (err) {
        const msg = mensagemErro(err);
        d.log.error({ contaId: conta.id, err: d.serializarErro(err) }, 'falha no sync da conta');
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        await d.repo.atualizarConta(conta.id, aposErro(conta, statusPorErro(err), msg, agora()));
        await d.repo.finalizarExecucao(execId, { status: 'ERRO', linhas: 0, erro: msg });
        return 'ERRO' as const;
      } finally {
        await d.repo.liberarLock(conta.id);
        span.end();
      }
    });
  }

  return {
    sincronizarConta,

    /** Percorre as contas coletáveis. Erro numa conta não derruba as outras. */
    async executarTick() {
      try {
        const [contas, clientes] = await Promise.all([d.repo.todasContas(), d.repo.listarClientes()]);
        const porId = new Map(clientes.map((c) => [c.id, c]));
        // ponytail: sequencial; paralelizar com limite se o tick passar de ~50% do intervalo; fila só se ainda estourar.
        for (const conta of contas) {
          const cliente = porId.get(conta.clienteId);
          if (!cliente || !coletavel(conta, cliente)) continue;
          try {
            await sincronizarConta(conta.id, 'CICLO');
          } catch (err) {
            d.log.error({ contaId: conta.id, err: d.serializarErro(err) }, 'erro inesperado no tick');
          }
        }
        await d.heartbeat?.(false);
      } catch (err) {
        d.log.error({ err: d.serializarErro(err) }, 'tick de sync quebrou');
        await d.heartbeat?.(true);
      }
    },

    /** Job diário: confere validade/expiração dos tokens (debug_token). */
    async verificarExpiracoes() {
      const [contas, clientes] = await Promise.all([d.repo.todasContas(), d.repo.listarClientes()]);
      const porId = new Map(clientes.map((c) => [c.id, c]));
      for (const conta of contas) {
        if (conta.status === 'PAUSADA' || conta.status === 'TOKEN_INVALIDO' || porId.get(conta.clienteId)?.status !== 'ATIVO') continue;
        try {
          const info = await d.meta.validarToken(d.cifra.decifrar(conta.tokenCifrado));
          if (!info.valido) {
            await d.repo.atualizarConta(conta.id, aposErro(conta, 'TOKEN_INVALIDO', `Token inválido: ${info.motivo ?? ''}`, agora()));
            continue;
          }
          const expirando = tokenExpirando(info.expiraEm, agora());
          const status =
            expirando && conta.status === 'ATIVA' ? 'TOKEN_EXPIRANDO'
            : !expirando && conta.status === 'TOKEN_EXPIRANDO' ? 'ATIVA'
            : conta.status;
          await d.repo.atualizarConta(conta.id, { tokenExpiraEm: info.expiraEm, status });
        } catch (err) {
          if (err instanceof ErroToken) {
            await d.repo.atualizarConta(conta.id, aposErro(conta, 'TOKEN_INVALIDO', mensagemErro(err), agora()));
          } else {
            d.log.warn({ contaId: conta.id, err: d.serializarErro(err) }, 'não foi possível verificar o token');
          }
        }
      }
    },
  };
}
