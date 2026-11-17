import { createHmac, timingSafeEqual } from 'node:crypto';

export interface Sessao {
  /** companyid da empresa */
  cid: string;
  /** user_id do agente (autor da auditoria) */
  uid: string;
  nome: string;
  admin: boolean;
  /** expiração em epoch ms */
  exp: number;
}

export const VALIDADE_SESSAO_MS = 12 * 60 * 60 * 1000;

const assinar = (corpo: string, segredo: string) => createHmac('sha256', segredo).update(corpo).digest('base64url');

/** base64url(JSON) + "." + HMAC-SHA256. */
export function emitirSessao(dados: Omit<Sessao, 'exp'>, segredo: string, agora = Date.now()): { token: string; exp: number } {
  const exp = agora + VALIDADE_SESSAO_MS;
  const corpo = Buffer.from(JSON.stringify({ ...dados, exp })).toString('base64url');
  return { token: `${corpo}.${assinar(corpo, segredo)}`, exp };
}

export function verificarSessao(token: string | undefined, segredo: string, agora = Date.now()): Sessao | null {
  if (!token) return null;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;
  const esperado = Buffer.from(assinar(corpo, segredo));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Sessao;
    if (typeof s.exp !== 'number' || s.exp <= agora || !s.cid || !s.uid) return null;
    return s;
  } catch {
    return null;
  }
}
