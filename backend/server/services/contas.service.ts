import type { Cifra } from '../domain/ports/Cifra.js';
import type { MetaGateway } from '../domain/ports/MetaGateway.js';
import { ErroIndisponivel, ErroLimite, ErroNegocio, ErroToken } from '../domain/ports/erros.js';
import type { ContaRegistro, ContaRepository, NumeroRegistro } from '../domain/ports/repositorios.js';
import { fusoIana } from '../domain/sync/normalizacao.js';
import { registrarAuditoria } from './auditoria.service.js';
import type { SyncService } from './sync.service.js';

const LOCK_MS = 30 * 60 * 1000;

/** Visão segura da conta: nunca contém o token. */
export function contaView(c: ContaRegistro, numeros: NumeroRegistro[]) {
  return {
    id: c.id, wabaId: c.wabaId, nome: c.nome, status: c.status, moeda: c.moeda, fuso: c.fuso,
    tokenUltimos4: c.tokenUltimos4, tokenExpiraEm: c.tokenExpiraEm, ultimoSync: c.ultimoSyncEm,
    ultimoErro: c.ultimoErro, semCustoMeta: c.semCustoMeta, historicoDesde: c.historicoDesde,
    sincronizando: emAndamento(c),
    numeros: numeros.map((n) => ({
      id: n.id, display: n.display, nomeVerificado: n.verifiedName, qualidade: n.qualidade,
      coletaAtiva: n.coletaAtiva, naoEncontradoNaMeta: n.naoEncontradoNaMeta,
    })),
  };
}

export const emAndamento = (c: ContaRegistro, agora = Date.now()) =>
  c.syncEmAndamentoDesde !== null && agora - c.syncEmAndamentoDesde.getTime() < LOCK_MS;

/** Erros da Meta no cadastro → erros do contrato. */
function erroMeta(err: unknown): never {
  if (err instanceof ErroToken) throw new ErroNegocio(422, 'TOKEN_META_INVALIDO', `Token recusado pela Meta: ${err.message}`);
  if (err instanceof ErroIndisponivel || err instanceof ErroLimite) {
    throw new ErroNegocio(503, 'META_INDISPONIVEL', 'A Meta não respondeu. Tente novamente em instantes');
  }
  if (err instanceof Error && err.message.startsWith('Meta recusou')) throw new ErroNegocio(422, 'TOKEN_META_INVALIDO', err.message);
  throw err;
}

interface Deps {
  repo: ContaRepository;
  meta: MetaGateway;
  cifra: Cifra;
  sync: Pick<SyncService, 'sincronizarConta'>;
  /** dispara sem aguardar (o erro é logado) */
  emSegundoPlano: (p: () => Promise<unknown>) => void;
  agora?: () => Date;
}

export type ContasService = ReturnType<typeof criarContasService>;

export function criarContasService(d: Deps) {
  const agora = d.agora ?? (() => new Date());

  async function obter(contaId: string) {
    const c = await d.repo.contaPorId(contaId);
    if (!c) throw new ErroNegocio(404, 'NAO_ENCONTRADO', 'Conta não encontrada');
    return c;
  }

  return {
    async criar(clienteId: string, dados: { wabaId: string; token: string; nome?: string }, autor: string) {
      const cliente = await d.repo.clientePorId(clienteId);
      if (!cliente) throw new ErroNegocio(404, 'NAO_ENCONTRADO', 'Cliente não encontrado');
      if (await d.repo.contaPorWabaId(dados.wabaId)) throw new ErroNegocio(409, 'DUPLICADO', 'WABA já cadastrada');
      // ponytail: token salvo sem debug_token (a Meta recusava tokens de System User de outro app); expiração fica nula.
      // Salva mesmo se a Meta recusar agora: a sync em segundo plano registra o erro na conta e, quando passar,
      // corrige moeda/fuso e traz os números.
      const waba = await d.meta.obterWaba(dados.token, dados.wabaId)
        .catch(() => ({ nome: dados.wabaId, moeda: 'USD', fusoMeta: null }));
      const numeros = await d.meta.listarNumeros(dados.token, dados.wabaId).catch(() => []);
      const conta = await d.repo.criarConta(
        {
          clienteId, companyid: cliente.companyid, wabaId: dados.wabaId, nome: dados.nome?.trim() || waba.nome,
          tokenCifrado: d.cifra.cifrar(dados.token), tokenUltimos4: dados.token.slice(-4), tokenExpiraEm: null,
          moeda: waba.moeda, fuso: fusoIana(waba.fusoMeta),
        },
        numeros,
      );
      await registrarAuditoria(d.repo, {
        companyid: cliente.companyid, userId: autor, acao: 'conta.criar', entidade: 'conta_waba', entidadeId: conta.id,
        dados: { wabaId: conta.wabaId, nome: conta.nome, token: dados.token, numeros: numeros.length },
      });
      // Backfill logo após o cadastro, sem segurar a resposta.
      d.emSegundoPlano(() => d.sync.sincronizarConta(conta.id, 'ADMIN'));
      return contaView(conta, await d.repo.numerosDaConta(conta.id));
    },

    async atualizar(contaId: string, p: { token?: string; pausada?: boolean; nome?: string }, autor: string) {
      const c = await obter(contaId);
      const patch: Parameters<ContaRepository['atualizarConta']>[1] = {};
      const audit: Record<string, unknown> = {};
      if (p.nome !== undefined) patch.nome = audit.nome = p.nome.trim();
      if (p.token) {
        Object.assign(patch, {
          tokenCifrado: d.cifra.cifrar(p.token), tokenUltimos4: p.token.slice(-4), tokenExpiraEm: null,
          status: 'ATIVA', ultimoErro: null, desatualizadoDesde: null,
        });
        audit.token = p.token;
      }
      if (p.pausada === true) {
        Object.assign(patch, { status: 'PAUSADA', desatualizadoDesde: c.desatualizadoDesde ?? agora() });
        audit.pausada = true;
      } else if (p.pausada === false && c.status === 'PAUSADA' && !p.token) {
        Object.assign(patch, { status: 'ATIVA', desatualizadoDesde: null });
        audit.pausada = false;
      }
      const conta = await d.repo.atualizarConta(contaId, patch);
      const acao = p.token ? 'conta.trocar_token' : p.pausada === true ? 'conta.pausar' : p.pausada === false ? 'conta.retomar' : 'conta.editar';
      await registrarAuditoria(d.repo, { companyid: c.companyid, userId: autor, acao, entidade: 'conta_waba', entidadeId: contaId, dados: audit });
      return contaView(conta, await d.repo.numerosDaConta(contaId));
    },

    /** Valida token e WABA sem coletar dados. */
    async testar(contaId: string) {
      const c = await obter(contaId);
      const token = d.cifra.decifrar(c.tokenCifrado);
      try {
        const info = await d.meta.validarToken(token);
        if (!info.valido) return { ok: false, tokenExpiraEm: info.expiraEm, escopos: info.escopos, problema: info.motivo };
        await d.meta.obterWaba(token, c.wabaId);
        return { ok: true, tokenExpiraEm: info.expiraEm, escopos: info.escopos };
      } catch (err) {
        return { ok: false, tokenExpiraEm: null, escopos: [], problema: err instanceof Error ? err.message.slice(0, 200) : 'erro' };
      }
    },

    /** Admin: sem o intervalo de 15 min, mas respeita o lock. */
    async sincronizarAgora(contaId: string) {
      const c = await obter(contaId);
      if (emAndamento(c)) throw new ErroNegocio(409, 'SYNC_EM_ANDAMENTO', 'Já existe uma sincronização em andamento');
      d.emSegundoPlano(() => d.sync.sincronizarConta(contaId, 'ADMIN'));
      return { iniciado: true };
    },

    async atualizarNumeros(contaId: string, autor: string) {
      const c = await obter(contaId);
      const numeros = await d.meta.listarNumeros(d.cifra.decifrar(c.tokenCifrado), c.wabaId).catch(erroMeta);
      const atualizados = await d.repo.sincronizarNumeros(c, numeros);
      await registrarAuditoria(d.repo, {
        companyid: c.companyid, userId: autor, acao: 'conta.atualizar_numeros', entidade: 'conta_waba', entidadeId: contaId,
        dados: { encontrados: numeros.length },
      });
      return contaView(c, atualizados).numeros;
    },

    async execucoes(contaId: string, limite = 20) {
      await obter(contaId);
      return d.repo.listarExecucoes(contaId, Math.min(Math.max(limite, 1), 100));
    },

    async alternarNumero(numeroId: string, coletaAtiva: boolean, autor: string) {
      const n = await d.repo.numeroPorId(numeroId);
      if (!n) throw new ErroNegocio(404, 'NAO_ENCONTRADO', 'Número não encontrado');
      const atualizado = await d.repo.atualizarNumero(numeroId, { coletaAtiva });
      await registrarAuditoria(d.repo, {
        companyid: n.companyid, userId: autor, acao: coletaAtiva ? 'numero.ativar' : 'numero.desativar',
        entidade: 'numero', entidadeId: numeroId, dados: { display: n.display },
      });
      return atualizado;
    },
  };
}
