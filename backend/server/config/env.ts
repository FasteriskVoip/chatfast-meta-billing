import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { z } from 'zod';

config({ path: 'backend/.env', quiet: true });

// Vazio = usa o padrão (ligado só em produção).
const bool = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1').optional(),
);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquema = z.object({
  PORT: z.coerce.number().int().default(3002),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  HELENA_API_URL: z.string().url().default('https://api.helena.run'),
  EXIGIR_EMBED: bool,
  EXIGIR_SESSAO: bool,
  ORIGENS_EMBED: z.string().default('https://app.chatfast.chat https://web.helena.run'),
  SEGREDO_SESSAO: z.string().optional(),
  ADMIN_COMPANYIDS: z
    .string()
    .default('')
    // Aceita vírgula, ponto e vírgula, espaço ou quebra de linha, com ou sem aspas (comum ao colar no Coolify).
    .transform((s) => s.split(/[\s,;]+/).map((x) => x.replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean))
    .refine((l) => l.every((x) => uuid.test(x)), 'ADMIN_COMPANYIDS deve ser CSV de UUIDs'),
  CHAVE_CRIPTOGRAFIA: z
    .string()
    .refine((s) => Buffer.from(s, 'base64').length === 32, 'CHAVE_CRIPTOGRAFIA deve ser 32 bytes em base64'),
  META_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v27.0'),
  SYNC_CRON: z.string().default('0 * * * *'),
  SYNC_DIAS_REPROCESSO: z.coerce.number().int().min(1).max(30).default(3),
  // A Meta guarda só 1 ano de pricing_analytics (research R-06).
  SYNC_DIAS_BACKFILL: z.coerce.number().int().min(1).default(90).transform((n) => Math.min(n, 365)),
  HEARTBEAT_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  // Webhook do n8n que recebe os alertas de consumo diário/mensal. Vazio = alertas desligados.
  N8N_WEBHOOK_ALERTAS: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  OTEL_SERVICE_NAME: z.string().default('consumo-meta'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type Env = ReturnType<typeof lerEnv>;

export function lerEnv(fonte: NodeJS.ProcessEnv) {
  const r = esquema.safeParse(fonte);
  if (!r.success) {
    const faltando = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida: ${faltando}`);
  }
  const e = r.data;
  const producao = e.NODE_ENV === 'production';
  let segredoGerado = false;
  let segredo = e.SEGREDO_SESSAO;
  if (!segredo || segredo.length < 32) {
    if (segredo) throw new Error('Configuração inválida: SEGREDO_SESSAO precisa de 32+ caracteres');
    segredo = randomBytes(32).toString('hex');
    segredoGerado = true;
  }
  return {
    ...e,
    SEGREDO_SESSAO: segredo,
    segredoGerado,
    EXIGIR_EMBED: e.EXIGIR_EMBED ?? producao,
    EXIGIR_SESSAO: e.EXIGIR_SESSAO ?? producao,
    producao,
  };
}

export const env = lerEnv(process.env);
