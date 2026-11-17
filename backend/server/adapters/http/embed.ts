import type { FastifyInstance } from 'fastify';

/**
 * Barreira de NAVEGADOR, não é autenticação: impede abrir as telas fora do iframe do Chatfast
 * (CSP frame-ancestors + bloqueio de navegação direta). Quem prova identidade é a sessão.
 */
export function registrarEmbed(app: FastifyInstance, opts: { exigir: boolean; origens: string }) {
  app.addHook('onSend', async (req, reply, payload) => {
    const tipo = String(reply.getHeader('content-type') ?? '');
    if (tipo.includes('text/html')) {
      reply.header('Content-Security-Policy', `frame-ancestors ${opts.origens}`);
    }
    return payload;
  });

  if (!opts.exigir) return;
  app.addHook('onRequest', async (req, reply) => {
    const caminho = req.url.split('?')[0]!;
    if (caminho.startsWith('/api/') || caminho === '/health') return;
    // Navegação de topo (aba nova, URL colada) chega como document; dentro do iframe chega como iframe.
    if (req.method === 'GET' && req.headers['sec-fetch-dest'] === 'document') {
      return reply.code(403).type('text/plain').send('Acesso negado');
    }
  });
}
