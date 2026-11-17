/** Pares fundo 50 + texto 700 do design system, para badges e alertas. */
export const TOM = {
  marca: 'bg-blue-50 text-blue-700',
  sucesso: 'bg-emerald-50 text-emerald-700',
  aviso: 'border-amber-200 bg-amber-50 text-atencao-texto',
  erro: 'bg-red-50 text-red-700',
  neutro: 'bg-slate-100 text-slate-500',
} as const;

export type Tom = keyof typeof TOM;

/** Qualidade do número na Meta, com texto (status nunca só por cor). */
export const ROTULO_QUALIDADE: Record<string, { texto: string; cls: string }> = {
  GREEN: { texto: 'Alta', cls: TOM.sucesso },
  YELLOW: { texto: 'Média', cls: TOM.aviso },
  RED: { texto: 'Baixa', cls: TOM.erro },
  UNKNOWN: { texto: 'Desconhecida', cls: TOM.neutro },
};
