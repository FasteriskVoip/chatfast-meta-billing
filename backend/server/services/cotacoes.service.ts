import { ErroNegocio } from '../domain/ports/erros.js';
import type { ContaRepository } from '../domain/ports/repositorios.js';
import { registrarAuditoria } from './auditoria.service.js';

/** Cotação é configuração global da Fasterisk: auditada com o companyid de quem alterou. */
export function criarCotacoesService(d: { repo: ContaRepository }) {
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
  };
}

export type CotacoesService = ReturnType<typeof criarCotacoesService>;
