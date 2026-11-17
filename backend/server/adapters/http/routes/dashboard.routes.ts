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
});

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
      const { companyid: _, ...f } = filtros.parse(req.query);
      return d.dashboard.resumo(empresaAlvo(req), f);
    });

    app.post('/sincronizar', async (req, reply) => {
      reply.code(202);
      return d.dashboard.sincronizar(empresaAlvo(req));
    });

    app.get('/exportar.xlsx', async (req, reply) => {
      const { companyid: _, ...f } = filtros.parse(req.query);
      const { arquivo, nome: arquivoNome } = await d.exportacao.xlsx(empresaAlvo(req), f);
      return reply
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${arquivoNome}"`)
        .send(arquivo);
    });
  };
