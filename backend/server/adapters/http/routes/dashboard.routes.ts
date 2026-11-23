import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GRUPOS } from '../../../domain/tipos.js';
import type { Deps } from '../app.js';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');

const filtros = z.object({
  de: data,
  ate: data,
  contaId: z.string().uuid().optional(),
  numeroId: z.string().uuid().optional(),
  categoria: z.enum(GRUPOS).optional(),
  companyid: z.string().uuid().optional(),
  custo: z.enum(['meta']).optional(),
});

/** custo=meta só vale para o admin: o cliente Taxi nunca vê o custo da Meta. */
const filtrosDe = (req: FastifyRequest) => {
  const { companyid: _, custo, ...f } = filtros.parse(req.query);
  return req.sessao.admin && custo ? { ...f, custo } : f;
};

/** Admin pode ver qualquer cliente passando companyid; os demais só a própria empresa. */
const empresaAlvo = (req: FastifyRequest) => {
  const q = req.query as { companyid?: string };
  return req.sessao.admin && q.companyid ? q.companyid.toLowerCase() : req.sessao.cid;
};

export const rotasDashboard =
  (d: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get('/filtros', async (req) => d.dashboard.filtros(empresaAlvo(req)));

    app.get('/status', async (req) => d.dashboard.status(empresaAlvo(req)));

    app.get('/resumo', async (req) => {
      const r = await d.dashboard.resumo(empresaAlvo(req), filtrosDe(req));
      // O nome do grupo é interno da Fasterisk: o cliente recebe só o preço.
      return req.sessao.admin || !r.fasterisk ? r : { ...r, fasterisk: { precoBrl: r.fasterisk.precoBrl } };
    });

    app.post('/sincronizar', async (req, reply) => {
      reply.code(202);
      return d.dashboard.sincronizar(empresaAlvo(req));
    });

    app.get('/exportar.xlsx', async (req, reply) => {
      const { arquivo, nome: arquivoNome } = await d.exportacao.xlsx(empresaAlvo(req), filtrosDe(req));
      return reply
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${arquivoNome}"`)
        .send(arquivo);
    });
  };
