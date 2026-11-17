import type { CategoriaMeta, Grupo, TipoPreco } from '../tipos.js';

/** 7 categorias da Meta → 4 grupos da tela (research R-02). OUTRA não tem grupo: soma só no total. */
const GRUPO: Record<CategoriaMeta, Grupo | null> = {
  MARKETING: 'MARKETING',
  MARKETING_LITE: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHENTICATION_INTERNATIONAL: 'AUTHENTICATION',
  SERVICE: 'SERVICE',
  REFERRAL_CONVERSION: 'SERVICE',
  OUTRA: null,
};

export const grupoDaCategoria = (c: CategoriaMeta): Grupo | null => GRUPO[c];

/** REGULAR é cobrada; FREE_* são gratuitas. */
export const ehCobrada = (t: TipoPreco) => t === 'REGULAR';
