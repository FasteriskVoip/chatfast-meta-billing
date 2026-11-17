import type { ContaRepository, NovaAuditoria } from '../domain/ports/repositorios.js';

/** Remove segredos: qualquer chave token* vira {ultimos4}. */
export function semSegredos(dados: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (/^token/i.test(k) && typeof v === 'string') out[k] = { ultimos4: v.slice(-4) };
    else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = semSegredos(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

export const registrarAuditoria = (repo: ContaRepository, d: NovaAuditoria) =>
  repo.registrarAuditoria({ ...d, dados: semSegredos(d.dados) });
