import type {
  ClienteRegistro, ContaRegistro, ContaRepository, CotacaoRegistro, GrupoCustoRegistro, NumeroRegistro,
} from '../../../domain/ports/repositorios.js';
import type { Prisma } from './client.js';
import { deData, deDataNula, paraData } from './client.js';

type ClienteRow = Awaited<ReturnType<Prisma['cliente']['findFirstOrThrow']>>;
type ContaRow = Awaited<ReturnType<Prisma['contaWaba']['findFirstOrThrow']>>;
type NumeroRow = Awaited<ReturnType<Prisma['numero']['findFirstOrThrow']>>;
type CotacaoRow = Awaited<ReturnType<Prisma['cotacao']['findFirstOrThrow']>>;
type GrupoCustoRow = Awaited<ReturnType<Prisma['grupoCusto']['findFirstOrThrow']>>;

const cliente = (r: ClienteRow): ClienteRegistro => ({
  id: r.id, companyid: r.companyid, nome: r.nome, status: r.status,
  tokenChatfastCifrado: r.tokenChatfastCifrado, tokenChatfastUltimos4: r.tokenChatfastUltimos4,
  inativoDesde: deDataNula(r.inativoDesde), alertaChatfast: r.alertaChatfast, taxi: r.taxi, grupoCustoId: r.grupoCustoId,
  limiteDiarioBrl: r.limiteDiarioBrl?.toFixed(2) ?? null, limiteMensalBrl: r.limiteMensalBrl?.toFixed(2) ?? null,
  alertaDiarioEm: deDataNula(r.alertaDiarioEm), alertaMensalEm: deDataNula(r.alertaMensalEm),
});
const conta = (r: ContaRow): ContaRegistro => ({
  id: r.id, clienteId: r.clienteId, companyid: r.companyid, wabaId: r.wabaId, nome: r.nome,
  tokenCifrado: r.tokenCifrado, tokenUltimos4: r.tokenUltimos4, tokenExpiraEm: r.tokenExpiraEm,
  moeda: r.moeda, fuso: r.fuso, status: r.status, semCustoMeta: r.semCustoMeta,
  historicoDesde: deDataNula(r.historicoDesde), ultimoSyncEm: r.ultimoSyncEm, ultimoErro: r.ultimoErro,
  desatualizadoDesde: r.desatualizadoDesde, syncEmAndamentoDesde: r.syncEmAndamentoDesde,
});
const numero = (r: NumeroRow): NumeroRegistro => ({
  id: r.id, contaWabaId: r.contaWabaId, companyid: r.companyid, phoneNumberId: r.phoneNumberId,
  display: r.displayPhoneNumber, verifiedName: r.verifiedName, qualidade: r.qualidade,
  coletaAtiva: r.coletaAtiva, naoEncontradoNaMeta: r.naoEncontradoNaMeta,
});
const cotacao = (r: CotacaoRow): CotacaoRegistro => ({
  id: r.id, valor: r.valor.toFixed(4), vigenteDesde: deData(r.vigenteDesde), criadoPor: r.criadoPor, criadoEm: r.criadoEm,
});

const grupoCusto = (r: GrupoCustoRow): GrupoCustoRegistro => ({ id: r.id, nome: r.nome, precoBrl: r.precoBrl.toFixed(4) });

/** Converte os campos 'YYYY-MM-DD' do domínio para Date antes de gravar. */
function comDatas<T extends object>(patch: T): Record<string, unknown> {
  const out = { ...patch } as Record<string, unknown>;
  for (const k of ['inativoDesde', 'historicoDesde', 'alertaDiarioEm', 'alertaMensalEm'] as const) {
    if (k in out) out[k] = out[k] ? paraData(out[k] as string) : null;
  }
  return out;
}

export function criarContaRepository(db: Prisma): ContaRepository {
  const repo: ContaRepository = {
    async clientePorCompanyid(companyid) {
      const r = await db.cliente.findUnique({ where: { companyid } });
      return r && cliente(r);
    },
    async clientePorId(id) {
      const r = await db.cliente.findUnique({ where: { id } });
      return r && cliente(r);
    },
    async listarClientes() {
      return (await db.cliente.findMany({ orderBy: { nome: 'asc' } })).map(cliente);
    },
    async criarCliente(d) {
      return cliente(await db.cliente.create({ data: d }));
    },
    async atualizarCliente(id, patch) {
      return cliente(await db.cliente.update({ where: { id }, data: comDatas(patch) }));
    },

    async todasContas() {
      return (await db.contaWaba.findMany({ orderBy: { criadoEm: 'asc' } })).map(conta);
    },
    async contasDoCliente(clienteId) {
      return (await db.contaWaba.findMany({ where: { clienteId }, orderBy: { criadoEm: 'asc' } })).map(conta);
    },
    async contasDaEmpresa(companyid) {
      return (await db.contaWaba.findMany({ where: { companyid }, orderBy: { criadoEm: 'asc' } })).map(conta);
    },
    async contaPorId(id) {
      const r = await db.contaWaba.findUnique({ where: { id } });
      return r && conta(r);
    },
    async contaPorWabaId(wabaId) {
      const r = await db.contaWaba.findUnique({ where: { wabaId } });
      return r && conta(r);
    },
    async criarConta(d, numeros) {
      const r = await db.contaWaba.create({
        data: {
          ...d,
          numeros: {
            create: numeros.map((n) => ({
              companyid: d.companyid, phoneNumberId: n.phoneNumberId, displayPhoneNumber: n.display,
              verifiedName: n.verifiedName, qualidade: n.qualidade,
            })),
          },
        },
      });
      return conta(r);
    },
    async atualizarConta(id, patch) {
      return conta(await db.contaWaba.update({ where: { id }, data: comDatas(patch) }));
    },
    async adquirirLock(contaId) {
      const n = await db.$executeRaw`
        UPDATE conta_waba SET sync_em_andamento_desde = now()
        WHERE id = ${contaId}::uuid
          AND (sync_em_andamento_desde IS NULL OR sync_em_andamento_desde < now() - interval '30 minutes')`;
      return n === 1;
    },
    async liberarLock(contaId) {
      await db.contaWaba.update({ where: { id: contaId }, data: { syncEmAndamentoDesde: null } });
    },

    async numerosDaConta(contaId) {
      const rs = await db.numero.findMany({ where: { contaWabaId: contaId }, orderBy: { displayPhoneNumber: 'asc' } });
      return rs.map(numero);
    },
    async numerosDaEmpresa(companyid) {
      const rs = await db.numero.findMany({ where: { companyid }, orderBy: { displayPhoneNumber: 'asc' } });
      return rs.map(numero);
    },
    async numeroPorId(id) {
      const r = await db.numero.findUnique({ where: { id } });
      return r && numero(r);
    },
    async sincronizarNumeros(c, numeros) {
      await db.$transaction([
        ...numeros.map((n) =>
          db.numero.upsert({
            where: { phoneNumberId: n.phoneNumberId },
            create: {
              contaWabaId: c.id, companyid: c.companyid, phoneNumberId: n.phoneNumberId,
              displayPhoneNumber: n.display, verifiedName: n.verifiedName, qualidade: n.qualidade,
            },
            update: { displayPhoneNumber: n.display, verifiedName: n.verifiedName, qualidade: n.qualidade, naoEncontradoNaMeta: false },
          }),
        ),
        db.numero.updateMany({
          where: { contaWabaId: c.id, phoneNumberId: { notIn: numeros.map((n) => n.phoneNumberId) } },
          data: { naoEncontradoNaMeta: true },
        }),
      ]);
      return repo.numerosDaConta(c.id);
    },
    async atualizarNumero(id, patch) {
      return numero(await db.numero.update({ where: { id }, data: patch }));
    },

    async iniciarExecucao(d) {
      const r = await db.execucaoSync.create({
        data: { ...d, janelaDe: paraData(d.janelaDe), janelaAte: paraData(d.janelaAte) },
      });
      return r.id;
    },
    async finalizarExecucao(id, d) {
      await db.execucaoSync.update({ where: { id }, data: { ...d, fim: new Date() } });
    },
    async listarExecucoes(contaId, limite) {
      const rs = await db.execucaoSync.findMany({ where: { contaWabaId: contaId }, orderBy: { inicio: 'desc' }, take: limite });
      return rs.map((r) => ({
        id: r.id, origem: r.origem, status: r.status, inicio: r.inicio, fim: r.fim,
        janelaDe: deData(r.janelaDe), janelaAte: deData(r.janelaAte), linhas: r.linhas, erro: r.erro,
      }));
    },

    async listarCotacoes() {
      return (await db.cotacao.findMany({ orderBy: { vigenteDesde: 'desc' } })).map(cotacao);
    },
    async salvarCotacao(d) {
      const vigenteDesde = paraData(d.vigenteDesde);
      const existia = await db.cotacao.findUnique({ where: { vigenteDesde } });
      const r = await db.cotacao.upsert({
        where: { vigenteDesde },
        create: { valor: d.valor, vigenteDesde, criadoPor: d.criadoPor },
        update: { valor: d.valor, criadoPor: d.criadoPor, criadoEm: new Date() },
      });
      return { cotacao: cotacao(r), substituiu: Boolean(existia) };
    },

    async listarGruposCusto() {
      return (await db.grupoCusto.findMany({ orderBy: { precoBrl: 'asc' } })).map(grupoCusto);
    },
    async salvarGrupoCusto({ id, ...d }) {
      return grupoCusto(id ? await db.grupoCusto.update({ where: { id }, data: d }) : await db.grupoCusto.create({ data: d }));
    },

    async registrarAuditoria(d) {
      await db.auditoria.create({ data: { ...d, dados: d.dados as object } });
    },
  };
  return repo;
}
