import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registrarEmbed } from '../../server/adapters/http/embed.js';

async function app(exigir: boolean) {
  const a = Fastify();
  registrarEmbed(a, { exigir, origens: 'https://app.chatfast.chat https://web.helena.run' });
  a.get('/dashboard', async (_req, reply) => reply.type('text/html').send('<html></html>'));
  a.get('/api/x', async () => ({ ok: true }));
  a.get('/health', async () => ({ ok: true }));
  return a;
}

const documento = { 'sec-fetch-dest': 'document' };

describe('embed (barreira de navegador)', () => {
  it('HTML sai com CSP frame-ancestors', async () => {
    const r = await (await app(false)).inject({ url: '/dashboard' });
    expect(r.headers['content-security-policy']).toBe('frame-ancestors https://app.chatfast.chat https://web.helena.run');
  });

  it('JSON não recebe CSP de frame', async () => {
    const r = await (await app(false)).inject({ url: '/api/x' });
    expect(r.headers['content-security-policy']).toBeUndefined();
  });

  it('navegação direta (document) dá 403 genérico quando exigido', async () => {
    const r = await (await app(true)).inject({ url: '/dashboard', headers: documento });
    expect(r.statusCode).toBe(403);
    expect(r.body).toBe('Acesso negado');
  });

  it('dentro do iframe passa', async () => {
    const r = await (await app(true)).inject({ url: '/dashboard', headers: { 'sec-fetch-dest': 'iframe' } });
    expect(r.statusCode).toBe(200);
  });

  it('/api/* e /health nunca são bloqueados', async () => {
    const a = await app(true);
    expect((await a.inject({ url: '/api/x', headers: documento })).statusCode).toBe(200);
    expect((await a.inject({ url: '/health', headers: documento })).statusCode).toBe(200);
  });

  it('EXIGIR_EMBED=false não bloqueia', async () => {
    const r = await (await app(false)).inject({ url: '/dashboard', headers: documento });
    expect(r.statusCode).toBe(200);
  });
});
