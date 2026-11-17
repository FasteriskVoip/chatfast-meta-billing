import type { EntradaResumo } from '../../../server/domain/consumo/agregacao.js';
import type { LinhaConsumo, LinhaMensagens } from '../../../server/domain/ports/repositorios.js';

export const linha = (p: Partial<LinhaConsumo>): LinhaConsumo => ({
  data: '2026-11-01', numeroId: 'n1', contaId: 'c1', categoria: 'MARKETING', tipoPreco: 'REGULAR', moeda: 'BRL',
  volume: 10, custo: '1.000000', semCusto: 0, ...p,
});

export const msg = (p: Partial<LinhaMensagens>): LinhaMensagens => ({
  data: '2026-11-01', numeroId: 'n1', enviadas: 0, entregues: 0, ...p,
});

export const entrada = (p: Partial<EntradaResumo>): EntradaResumo => ({
  de: '2026-11-01', ate: '2026-11-03', hoje: '2026-11-17', consumo: [], mensagens: [],
  numeros: [
    { id: 'n1', conta: 'WABA', display: '+55 61 3399-3888', nomeVerificado: 'A', qualidade: 'GREEN' },
    { id: 'n2', conta: 'WABA', display: '+55 85 4000-0000', nomeVerificado: 'B', qualidade: 'YELLOW' },
  ],
  cotacoes: [], ...p,
});
