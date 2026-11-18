import { hojeNoFuso } from '../domain/consumo/periodo.js';
import type { Cifra } from '../domain/ports/Cifra.js';
import type { HelenaGateway } from '../domain/ports/HelenaGateway.js';
import { ErroIndisponivel, ErroNegocio, ErroToken } from '../domain/ports/erros.js';
import type { ClienteRegistro, ContaRegistro, ContaRepository } from '../domain/ports/repositorios.js';
import { FUSO_PADRAO } from '../domain/sync/normalizacao.js';
import { STATUS_PROBLEMA, piorStatus } from '../domain/sync/status.js';
import { registrarAuditoria } from './auditoria.service.js';
import { contaView } from './contas.service.js';
import type { SyncService } from './sync.service.js';

const clienteView = (c: ClienteRegistro) => ({
  id: c.id, nome: c.nome, companyid: c.companyid, status: c.status,
  tokenChatfastUltimos4: c.tokenChatfastUltimos4, alertaChatfast: c.alertaChatfast, taxi: c.taxi,
  limiteDiarioBrl: c.limiteDiarioBrl, limiteMensalBrl: c.limiteMensalBrl,
});

interface Deps {
  repo: ContaRepository;
  helena: HelenaGateway;
  cifra: Cifra;
  sync: Pick<SyncService, 'sincronizarConta'>;
  emSegundoPlano: (p: () => Promise<unknown>) => void;
  /** N8N_WEBHOOK_ALERTAS configurado: sem ele, os limites ficam salvos mas nenhum alerta sai. */
  alertasAtivos?: boolean;
  /** Cotação buscada sozinha no Banco Central (PTAX). */
  cotacaoAutomatica?: boolean;
  agora?: () => Date;
}

export type ClientesService = ReturnType<typeof criarClientesService>;

export function criarClientesService(d: Deps) {
  const agora = d.agora ?? (() => new Date());

  async function validarTokenChatfast(token: string) {
    try {
      await d.helena.listarAgentes(token);
    } catch (err) {
      if (err instanceof ErroToken) throw new ErroNegocio(422, 'VALIDACAO', 'tokenChatfast: recusado pela Helena');
      if (err instanceof ErroIndisponivel) throw new ErroNegocio(503, 'HELENA_INDISPONIVEL', 'Helena indisponível. Tente novamente');
      throw err;
    }
  }

  async function obter(id: string) {
    const c = await d.repo.clientePorId(id);
    if (!c) throw new ErroNegocio(404, 'NAO_ENCONTRADO', 'Cliente não encontrado');
    return c;
  }

  /** Reprocessa o período inativo; só limpa `inativoDesde` quando todas as contas coletarem. */
  async function reprocessarReativado(c: ClienteRegistro) {
    const contas = await d.repo.contasDoCliente(c.id);
    let todasOk = true;
    for (const conta of contas) {
      if (conta.status === 'PAUSADA') continue;
      if ((await d.sync.sincronizarConta(conta.id, 'ADMIN')) !== 'OK') todasOk = false;
    }
    if (todasOk) await d.repo.atualizarCliente(c.id, { inativoDesde: null });
  }

  return {
    async listar() {
      const [clientes, contas] = await Promise.all([d.repo.listarClientes(), d.repo.todasContas()]);
      const porCliente = new Map<string, ContaRegistro[]>();
      for (const c of contas) porCliente.set(c.clienteId, [...(porCliente.get(c.clienteId) ?? []), c]);
      return clientes.map((c) => {
        const cs = porCliente.get(c.id) ?? [];
        const ultimos = cs.map((x) => x.ultimoSyncEm?.getTime() ?? 0).filter(Boolean);
        return {
          ...clienteView(c),
          contas: cs.length,
          piorStatus: piorStatus(cs.map((x) => x.status)),
          ultimoSync: ultimos.length ? new Date(Math.max(...ultimos)) : null,
          alerta: c.alertaChatfast || cs.some((x) => STATUS_PROBLEMA.has(x.status) && x.status !== 'PAUSADA'),
        };
      });
    },

    async painel() {
      const [contas, cotacoes] = await Promise.all([d.repo.todasContas(), d.repo.listarCotacoes()]);
      const hoje = hojeNoFuso(agora(), FUSO_PADRAO);
      const vigente = cotacoes.find((c) => c.vigenteDesde <= hoje) ?? null;
      return {
        contasComProblema: contas.filter((c) => c.status === 'TOKEN_INVALIDO' || c.status === 'ERRO_SYNC' || c.status === 'TOKEN_EXPIRANDO').length,
        cotacaoVigente: vigente && { valor: vigente.valor, vigenteDesde: vigente.vigenteDesde },
        semCotacao: cotacoes.length === 0,
        alertasAtivos: d.alertasAtivos ?? false,
        cotacaoAutomatica: d.cotacaoAutomatica ?? false,
      };
    },

    async criar(dados: { nome: string; companyid: string; tokenChatfast: string; taxi?: boolean }, autor: string) {
      const companyid = dados.companyid.toLowerCase();
      if (await d.repo.clientePorCompanyid(companyid)) throw new ErroNegocio(409, 'DUPLICADO', 'Empresa já cadastrada');
      await validarTokenChatfast(dados.tokenChatfast);
      const c = await d.repo.criarCliente({
        companyid, nome: dados.nome.trim(), taxi: dados.taxi ?? false,
        tokenChatfastCifrado: d.cifra.cifrar(dados.tokenChatfast), tokenChatfastUltimos4: dados.tokenChatfast.slice(-4),
      });
      await registrarAuditoria(d.repo, {
        companyid, userId: autor, acao: 'cliente.criar', entidade: 'cliente', entidadeId: c.id,
        dados: { nome: c.nome, taxi: c.taxi, tokenChatfast: dados.tokenChatfast },
      });
      return clienteView(c);
    },

    async detalhar(id: string) {
      const c = await obter(id);
      const contas = await d.repo.contasDoCliente(id);
      return {
        ...clienteView(c),
        inativoDesde: c.inativoDesde,
        alertaDiarioEm: c.alertaDiarioEm,
        alertaMensalEm: c.alertaMensalEm,
        contas: await Promise.all(contas.map(async (x) => contaView(x, await d.repo.numerosDaConta(x.id)))),
      };
    },

    async atualizar(
      id: string,
      p: {
        nome?: string; tokenChatfast?: string; status?: 'ATIVO' | 'INATIVO'; taxi?: boolean;
        limiteDiarioBrl?: string | null; limiteMensalBrl?: string | null;
      },
      autor: string,
    ) {
      const c = await obter(id);
      const patch: Parameters<ContaRepository['atualizarCliente']>[1] = {};
      const audit: Record<string, unknown> = {};
      if (p.nome !== undefined) patch.nome = audit.nome = p.nome.trim();
      if (p.taxi !== undefined) patch.taxi = audit.taxi = p.taxi;
      // Limite novo (ou removido) zera o "já enviado": o novo valor pode disparar ainda no mesmo dia/mês.
      // O form manda os dois limites; zera só o "já enviado" do que mudou de valor (senão o outro alerta sai de novo).
      const mudou = (novo: string | null, atual: string | null) => (novo === null || atual === null ? novo !== atual : Number(novo) !== Number(atual));
      if (p.limiteDiarioBrl !== undefined && mudou(p.limiteDiarioBrl, c.limiteDiarioBrl)) {
        Object.assign(patch, { limiteDiarioBrl: (audit.limiteDiarioBrl = p.limiteDiarioBrl), alertaDiarioEm: null });
      }
      if (p.limiteMensalBrl !== undefined && mudou(p.limiteMensalBrl, c.limiteMensalBrl)) {
        Object.assign(patch, { limiteMensalBrl: (audit.limiteMensalBrl = p.limiteMensalBrl), alertaMensalEm: null });
      }
      if (p.tokenChatfast) {
        await validarTokenChatfast(p.tokenChatfast);
        Object.assign(patch, {
          tokenChatfastCifrado: d.cifra.cifrar(p.tokenChatfast), tokenChatfastUltimos4: p.tokenChatfast.slice(-4), alertaChatfast: false,
        });
        audit.tokenChatfast = p.tokenChatfast;
      }
      const desativando = p.status === 'INATIVO' && c.status === 'ATIVO';
      const reativando = p.status === 'ATIVO' && c.status === 'INATIVO';
      // Tokens e histórico são mantidos (decisão da spec, US-16).
      if (desativando) Object.assign(patch, { status: 'INATIVO', inativoDesde: hojeNoFuso(agora(), FUSO_PADRAO) });
      if (reativando) patch.status = 'ATIVO';
      const atualizado = await d.repo.atualizarCliente(id, patch);
      const alertas = p.limiteDiarioBrl !== undefined || p.limiteMensalBrl !== undefined;
      const acao = desativando ? 'cliente.desativar' : reativando ? 'cliente.reativar' : p.tokenChatfast ? 'cliente.trocar_token_chatfast'
        : alertas ? 'cliente.alertas' : 'cliente.editar';
      await registrarAuditoria(d.repo, { companyid: c.companyid, userId: autor, acao, entidade: 'cliente', entidadeId: id, dados: audit });
      if (reativando) d.emSegundoPlano(() => reprocessarReativado(atualizado));
      return clienteView(atualizado);
    },
  };
}
