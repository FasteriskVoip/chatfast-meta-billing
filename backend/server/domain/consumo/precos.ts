import { deMicro, paraMicro } from './cotacao.js';
import type { CategoriaMeta, DataISO, TipoPreco } from '../tipos.js';

/**
 * Preço por mensagem da Meta em BRL, para estimar o custo quando a Meta não informa (WABA cobrada via parceiro).
 * ponytail: valores de lista do Brasil vigentes desde 2026-10-01, levantados em fontes secundárias; conferir com o
 * CSV "BRL list rates" da Meta e acrescentar uma vigência a cada reajuste trimestral (1/jan, 1/abr, 1/jul, 1/out).
 * Ignora o país do destinatário e os descontos por faixa de volume (utilidade/autenticação): superestima quem manda muito.
 */
const TABELA: { vigenteDesde: DataISO; precos: Partial<Record<CategoriaMeta, string>> }[] = [
  { vigenteDesde: '2026-10-01', precos: { MARKETING: '0.3217', UTILITY: '0.035', AUTHENTICATION: '0.035', SERVICE: '0.035' } },
];

/** Custo estimado em BRL; null quando não há preço para o dia/categoria. Mensagem gratuita custa 0. */
export function custoEstimadoBrl(l: { data: DataISO; categoria: CategoriaMeta; tipoPreco: TipoPreco; volume: number }): string | null {
  const vigente = TABELA.filter((t) => t.vigenteDesde <= l.data).sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1))[0];
  if (!vigente) return null;
  if (l.tipoPreco !== 'REGULAR') return '0';
  const preco = vigente.precos[l.categoria];
  if (!preco) return null;
  const [int = '0', frac = ''] = preco.split('.');
  const micro = (BigInt(int) * 1_000_000n + BigInt((frac + '000000').slice(0, 6))) * BigInt(l.volume);
  return `${micro / 1_000_000n}.${(micro % 1_000_000n).toString().padStart(6, '0')}`;
}

/**
 * Cliente Taxi: o custo que ele vê é o preço do grupo Fasterisk (R$) × mensagens cobradas; grátis custa 0.
 * Troca o custo da Meta nas linhas, então toda a agregação (categorias, dias, números, Excel) segue igual.
 * ponytail: preço sem vigência; editar o grupo muda também o passado. Guardar vigência como na cotação se precisar.
 */
export function aplicarPrecoFasterisk<T extends { tipoPreco: TipoPreco; volume: number; custo: string | null; moeda: string; semCusto: number }>(
  linhas: T[], precoBrl: string,
): T[] {
  const preco = paraMicro(precoBrl);
  return linhas.map((l) => ({
    ...l, custo: deMicro(l.tipoPreco === 'REGULAR' ? preco * BigInt(l.volume) : 0n), moeda: 'BRL', semCusto: 0,
  }));
}
