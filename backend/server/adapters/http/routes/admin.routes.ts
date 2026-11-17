import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Deps } from '../app.js';

const id = z.string().uuid();
const token = z.string().trim().min(10, 'token muito curto').max(1000);

const novoCliente = z.object({
  nome: z.string().trim().min(1).max(120),
  companyid: z.string().uuid('companyid deve ser um UUID'),
  tokenChatfast: token,
});
const editarCliente = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  tokenChatfast: token.optional(),
  status: z.enum(['ATIVO', 'INATIVO']).optional(),
});
const novaConta = z.object({
  wabaId: z.string().trim().regex(/^\d{5,30}$/, 'WABA ID numérico'),
  token,
  nome: z.string().trim().max(120).optional(),
});
const editarConta = z.object({
  token: token.optional(),
  pausada: z.boolean().optional(),
  nome: z.string().trim().min(1).max(120).optional(),
});
const novaCotacao = z.object({
  valor: z.string().regex(/^\d{1,6}([.,]\d{1,4})?$/, 'valor com até 4 casas').transform((v) => v.replace(',', '.')),
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'),
});

const p = <K extends string>(params: unknown, chave: K) => id.parse((params as Record<K, unknown>)[chave]);

export const rotasAdmin =
  (d: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get('/painel', async () => d.clientes.painel());

    app.get('/clientes', async () => d.clientes.listar());
    app.post('/clientes', async (req, reply) => {
      reply.code(201);
      return d.clientes.criar(novoCliente.parse(req.body), req.sessao.uid);
    });
    app.get('/clientes/:clienteId', async (req) => d.clientes.detalhar(p(req.params, 'clienteId')));
    app.patch('/clientes/:clienteId', async (req) =>
      d.clientes.atualizar(p(req.params, 'clienteId'), editarCliente.parse(req.body), req.sessao.uid),
    );

    app.post('/clientes/:clienteId/contas', async (req, reply) => {
      reply.code(201);
      return d.contas.criar(p(req.params, 'clienteId'), novaConta.parse(req.body), req.sessao.uid);
    });
    app.patch('/contas/:contaId', async (req) =>
      d.contas.atualizar(p(req.params, 'contaId'), editarConta.parse(req.body), req.sessao.uid),
    );
    app.post('/contas/:contaId/testar', async (req) => d.contas.testar(p(req.params, 'contaId')));
    app.post('/contas/:contaId/sincronizar', async (req, reply) => {
      reply.code(202);
      return d.contas.sincronizarAgora(p(req.params, 'contaId'));
    });
    app.post('/contas/:contaId/atualizar-numeros', async (req) =>
      d.contas.atualizarNumeros(p(req.params, 'contaId'), req.sessao.uid),
    );
    app.get('/contas/:contaId/execucoes', async (req) => {
      const { limite } = z.object({ limite: z.coerce.number().int().optional() }).parse(req.query);
      return d.contas.execucoes(p(req.params, 'contaId'), limite);
    });
    app.patch('/numeros/:numeroId', async (req) => {
      const { coletaAtiva } = z.object({ coletaAtiva: z.boolean() }).parse(req.body);
      return d.contas.alternarNumero(p(req.params, 'numeroId'), coletaAtiva, req.sessao.uid);
    });

    app.get('/cotacoes', async () => d.cotacoes.listar());
    app.post('/cotacoes', async (req, reply) => {
      reply.code(201);
      return d.cotacoes.criar(novaCotacao.parse(req.body), { uid: req.sessao.uid, cid: req.sessao.cid });
    });
  };
