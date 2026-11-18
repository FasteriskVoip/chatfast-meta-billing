import { AxiosError, type AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { criarWebhookAlertas } from '../../server/adapters/n8n/webhookAlertas.js';
import { serializarErro } from '../../server/logger.js';

const URL_SECRETA = 'https://n8n.exemplo.com/webhook/7f3c-segredo-no-caminho';

describe('webhook de alertas (n8n)', () => {
  it('faz POST do alerta em JSON na URL configurada', async () => {
    const post = vi.fn(async () => ({ status: 200 }));
    await criarWebhookAlertas(URL_SECRETA, { post } as unknown as AxiosInstance).enviar({ evento: 'consumo.limite_diario' } as never);
    expect(post).toHaveBeenCalledWith(URL_SECRETA, { evento: 'consumo.limite_diario' }, { timeout: 10_000 });
  });

  it('erro sai sem a URL: no n8n o segredo fica no caminho e não pode ir ao log', async () => {
    const falha = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', { url: URL_SECRETA } as never, null, { status: 500 } as never);
    const post = vi.fn(async () => {
      throw falha;
    });
    const erro = await criarWebhookAlertas(URL_SECRETA, { post } as unknown as AxiosInstance).enviar({} as never).catch((e: unknown) => e);
    expect((erro as Error).message).toBe('webhook de alertas respondeu 500');
    expect(JSON.stringify(serializarErro(erro))).not.toContain('segredo');
  });
});
