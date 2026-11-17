import { pino } from 'pino';
import { isAxiosError } from 'axios';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: ['req.headers.authorization', '*.token', '*.tokenChatfast', '*.access_token'],
});

/** URL sem query string: tokens nunca podem aparecer no log. */
export function urlSemQuery(url?: string): string | undefined {
  return url?.split('?')[0];
}

/**
 * Erro pronto para log. Do axios mantém só método, URL sem query, status e código:
 * headers (Authorization) e body (payload da Meta) ficam de fora.
 */
export function serializarErro(err: unknown): Record<string, unknown> {
  if (isAxiosError(err)) {
    return {
      tipo: 'axios',
      mensagem: err.message.split('?')[0],
      metodo: err.config?.method?.toUpperCase(),
      url: urlSemQuery(err.config?.url),
      status: err.response?.status,
      codigo: err.code,
    };
  }
  if (err instanceof Error) return { tipo: err.name, mensagem: err.message, stack: err.stack };
  return { tipo: typeof err, mensagem: String(err) };
}
