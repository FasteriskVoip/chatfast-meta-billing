import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { trace } from '@opentelemetry/api';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErroNegocio } from '../../domain/ports/erros.js';
import type { ContaRepository } from '../../domain/ports/repositorios.js';
import type { ClientesService } from '../../services/clientes.service.js';
import type { ContasService } from '../../services/contas.service.js';
import type { CotacoesService } from '../../services/cotacoes.service.js';
import type { DashboardService } from '../../services/dashboard.service.js';
import type { ExportacaoService } from '../../services/exportacao.service.js';
import type { SessaoService } from '../../services/sessao.service.js';
import { registrarEmbed } from './embed.js';
import { rotasAdmin } from './routes/admin.routes.js';
import { rotasDashboard } from './routes/dashboard.routes.js';
import { rotasSessao } from './routes/sessao.routes.js';
import { verificarSessao, type Sessao } from './sessao.js';

declare module 'fastify' {
  interface FastifyRequest {
    sessao: Sessao;
  }
}

export interface Deps {
  cfg: {
    exigirEmbed: boolean;
    exigirSessao: boolean;
    origensEmbed: string;
    segredoSessao: string;
    /** pasta do build do front; ausente nos testes */
    pastaCliente?: string;
  };
  repo: Pick<ContaRepository, 'contaPorId' | 'numeroPorId' | 'clientePorId'>;
  sessao: Pick<SessaoService, 'abrir' | 'primeiroAcesso'>;
  dashboard: DashboardService;
  exportacao: ExportacaoService;
  clientes: ClientesService;
  contas: ContasService;
  cotacoes: CotacoesService;
  saude: () => Promise<void>;
  logger?: boolean | object;
}

/** Rotas públicas (sem sessão). Webhook da Meta entraria aqui, validado por assinatura. */
const SEM_SESSAO = new Set(['POST /api/sessao', 'POST /api/sessao/primeiro-acesso']);

const erro = (status: number, codigo: string, error: string) => new ErroNegocio(status, codigo, error);

const traceId = (req: FastifyRequest) => trace.getActiveSpan()?.spanContext().traceId ?? req.id;

/** Todo companyid/recurso citado na requisição precisa ser da empresa da sessão (admin opera qualquer uma). */
async function pertenceAEmpresa(req: FastifyRequest, repo: Deps['repo']) {
  const s = req.sessao;
  if (s.admin) return;
  const fontes = [req.params, req.query, req.body].filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  for (const f of fontes) {
    for (const chave of ['companyid', 'company_id']) {
      const v = f[chave];
      if (v !== undefined && String(v).toLowerCase() !== s.cid) throw erro(403, 'FORA_DA_EMPRESA', 'Recurso de outra empresa');
    }
  }
  const p = req.params as Record<string, string | undefined>;
  const q = req.query as Record<string, string | undefined>;
  for (const contaId of [p.contaId, q?.contaId]) {
    if (contaId && (await repo.contaPorId(contaId))?.companyid !== s.cid) throw erro(403, 'FORA_DA_EMPRESA', 'Recurso de outra empresa');
  }
  for (const numeroId of [p.numeroId, q?.numeroId]) {
    if (numeroId && (await repo.numeroPorId(numeroId))?.companyid !== s.cid) throw erro(403, 'FORA_DA_EMPRESA', 'Recurso de outra empresa');
  }
  if (p.clienteId && (await repo.clientePorId(p.clienteId))?.companyid !== s.cid) {
    throw erro(403, 'FORA_DA_EMPRESA', 'Recurso de outra empresa');
  }
}

export async function criarApp(d: Deps): Promise<FastifyInstance> {
  const app = Fastify({ logger: d.logger ?? false, genReqId: () => randomUUID() });
  await app.register(cors, { origin: false });
  registrarEmbed(app, { exigir: d.cfg.exigirEmbed, origens: d.cfg.origensEmbed });

  // Span HTTP nomeado pela rota (não pela URL com ids).
  app.addHook('onRequest', async (req) => {
    const rota = req.routeOptions.url;
    if (rota) trace.getActiveSpan()?.updateName(`${req.method} ${rota}`);
  });

  app.decorateRequest('sessao', null as unknown as Sessao);
  app.addHook('preHandler', async (req) => {
    const caminho = req.url.split('?')[0]!;
    if (!caminho.startsWith('/api/')) return;
    if (SEM_SESSAO.has(`${req.method} ${req.routeOptions.url ?? caminho}`)) return;
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const sessao = verificarSessao(bearer, d.cfg.segredoSessao);
    if (sessao) req.sessao = sessao;
    else if (!d.cfg.exigirSessao) {
      // Só em dev: sem sessão, opera como admin na empresa informada.
      const cid = String(
        (req.query as Record<string, unknown>)?.companyid ?? req.headers['x-companyid'] ?? '00000000-0000-0000-0000-000000000000',
      ).toLowerCase();
      req.sessao = { cid, uid: 'dev', nome: 'dev', admin: true, exp: Date.now() + 60_000 };
    } else throw erro(401, 'SESSAO_INVALIDA', 'Sessão inválida ou expirada');
    if (caminho.startsWith('/api/admin/') && !req.sessao.admin) {
      throw erro(403, 'SEM_PERMISSAO_ADMIN', 'Sem permissão de administrador');
    }
    await pertenceAEmpresa(req, d.repo);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ErroNegocio) {
      return reply.code(err.status).send({ error: err.message, codigo: err.codigo, ...err.extra });
    }
    if (err instanceof ZodError) {
      const i = err.issues[0];
      return reply.code(400).send({ error: `${i?.path.join('.') || 'corpo'}: ${i?.message}`, codigo: 'VALIDACAO' });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error({ err }, 'erro interno');
    return reply.code(500).send({ error: 'Erro interno. Tente novamente', traceId: traceId(req) });
  });

  app.get('/health', async () => {
    await d.saude();
    return { ok: true };
  });

  await app.register(rotasSessao(d), { prefix: '/api' });
  await app.register(rotasDashboard(d), { prefix: '/api/dashboard' });
  await app.register(rotasAdmin(d), { prefix: '/api/admin' });

  if (d.cfg.pastaCliente && existsSync(d.cfg.pastaCliente)) {
    await app.register(fastifyStatic, { root: d.cfg.pastaCliente, index: false });
    // SPA: /dashboard e /admin caem no index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.type('text/html').sendFile('index.html');
      return reply.code(404).send({ error: 'Não encontrado', codigo: 'NAO_ENCONTRADO' });
    });
  }
  return app;
}
