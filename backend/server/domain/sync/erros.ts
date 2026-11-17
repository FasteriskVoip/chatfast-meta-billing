import { ErroIndisponivel, ErroLimite, ErroToken } from '../ports/erros.js';
import type { StatusConta } from '../tipos.js';

/** Códigos da Graph API (research R-09). */
export const CODIGOS_TOKEN = new Set([190, 102, 463, 467]);
export const CODIGOS_LIMITE = new Set([4, 17, 613, 80007, 80008]);

export const BACKOFF_MS = [2000, 4000, 8000];

/** Token inválido não adianta repetir; limite e indisponibilidade tentam até 3 vezes. */
export function deveRetentar(err: unknown, tentativa: number): boolean {
  if (err instanceof ErroToken) return false;
  return (err instanceof ErroLimite || err instanceof ErroIndisponivel) && tentativa < BACKOFF_MS.length;
}

export function statusPorErro(err: unknown): Extract<StatusConta, 'TOKEN_INVALIDO' | 'ERRO_SYNC'> {
  return err instanceof ErroToken ? 'TOKEN_INVALIDO' : 'ERRO_SYNC';
}

/** Mensagem curta para `ultimo_erro`: sem payload, sem token. */
export function mensagemErro(err: unknown): string {
  if (err instanceof ErroToken) return `Token inválido: ${err.message}`;
  if (err instanceof ErroLimite) return 'Limite de chamadas da Meta atingido; nova tentativa no próximo ciclo';
  if (err instanceof ErroIndisponivel) return 'Meta indisponível ou lenta; nova tentativa no próximo ciclo';
  return err instanceof Error ? err.message.slice(0, 300) : 'Erro desconhecido';
}
