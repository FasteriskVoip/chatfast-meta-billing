import { hojeNoFuso, somarDias } from '../domain/consumo/periodo.js';
import { ErroNegocio } from '../domain/ports/erros.js';
import type { FonteCotacao } from '../domain/ports/FonteCotacao.js';
import type { ContaRepository } from '../domain/ports/repositorios.js';
import { FUSO_PADRAO } from '../domain/sync/normalizacao.js';
import { registrarAuditoria } from './auditoria.service.js';

/** criadoPor das cotações que vieram do Banco Central (as manuais guardam o uid de quem cadastrou). */
export const AUTOR_PTAX = 'banco-central-ptax';

/** Cotação é configuração global da Fasterisk: auditada com o companyid de quem alterou. */
export function criarCotacoesService(d: {
  repo: ContaRepository;
  /** null/ausente = sem busca automática (só cadastro manual). */
  fonte?: FonteCotacao | null;
  /** Na primeira busca, quantos dias para trás (o mesmo histórico da coleta de consumo). */
  diasHistorico?: number;
  log?: { info(o: object, msg: string): void };
  agora?: () => Date;
}) {
  const agora = d.agora ?? (() => new Date());

  return {
    listar: () => d.repo.listarCotacoes(),

    async criar(dados: { valor: string; vigenteDesde: string }, autor: { uid: string; cid: string }) {
      if (!/^\d{1,6}(\.\d{1,4})?$/.test(dados.valor) || Number(dados.valor) <= 0) {
        throw new ErroNegocio(400, 'VALIDACAO', 'valor: informe um número maior que zero com até 4 casas');
      }
      const { cotacao, substituiu } = await d.repo.salvarCotacao({ ...dados, criadoPor: autor.uid });
      await registrarAuditoria(d.repo, {
        companyid: autor.cid, userId: autor.uid, acao: substituiu ? 'cotacao.substituir' : 'cotacao.criar',
        entidade: 'cotacao', entidadeId: cotacao.id, dados: { valor: cotacao.valor, vigenteDesde: cotacao.vigenteDesde },
      });
      return cotacao;
    },

    /**
     * Busca a PTAX do Banco Central e grava os dias que faltam. Na primeira vez traz o histórico; depois, só
     * a partir da última PTAX gravada. Nunca sobrescreve uma data que já tem cotação (a manual vale).
     */
    async sincronizarOficial() {
      if (!d.fonte) return 0;
      const hoje = hojeNoFuso(agora(), FUSO_PADRAO);
      const existentes = await d.repo.listarCotacoes();
      const ultimaPtax = existentes.filter((c) => c.criadoPor === AUTOR_PTAX).map((c) => c.vigenteDesde).sort().at(-1);
      const de = ultimaPtax ?? somarDias(hoje, -(d.diasHistorico ?? 90));
      const ocupadas = new Set(existentes.map((c) => c.vigenteDesde));
      const novas = (await d.fonte.dolarVenda(de, hoje)).filter((c) => !ocupadas.has(c.data));
      for (const c of novas) await d.repo.salvarCotacao({ valor: c.valor, vigenteDesde: c.data, criadoPor: AUTOR_PTAX });
      if (novas.length) d.log?.info({ dias: novas.length, ultima: novas.at(-1) }, 'cotação PTAX gravada');
      return novas.length;
    },
  };
}

export type CotacoesService = ReturnType<typeof criarCotacoesService>;
