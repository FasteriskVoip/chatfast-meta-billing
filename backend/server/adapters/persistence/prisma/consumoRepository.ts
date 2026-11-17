import type { ConsumoRepository, FiltroFatos, LinhaConsumo, LinhaMensagens } from '../../../domain/ports/repositorios.js';
import type { CategoriaMeta, TipoPreco } from '../../../domain/tipos.js';
import { Prisma as P } from '../../../generated/prisma/client.js';
import type { Prisma } from './client.js';

const LOTE = 1000;

function filtrosOpcionais(f: FiltroFatos) {
  const conta = f.contaId ? P.sql`AND conta_waba_id = ${f.contaId}::uuid` : P.empty;
  const numero = f.numeroId ? P.sql`AND numero_id = ${f.numeroId}::uuid` : P.empty;
  return P.sql`${conta} ${numero}`;
}

export function criarConsumoRepository(db: Prisma): ConsumoRepository {
  return {
    // Upsert em lote via unnest: reprocessar a janela não duplica (chave natural).
    async upsertConsumo(linhas) {
      let total = 0;
      for (let i = 0; i < linhas.length; i += LOTE) {
        const l = linhas.slice(i, i + LOTE);
        total += await db.$executeRaw`
          INSERT INTO consumo_diario
            (companyid, conta_waba_id, numero_id, data, categoria, tipo_preco, pais, tier, volume, custo, moeda, atualizado_em)
          SELECT u.*, now() FROM unnest(
            ${l.map((x) => x.companyid)}::uuid[], ${l.map((x) => x.contaWabaId)}::uuid[], ${l.map((x) => x.numeroId)}::uuid[],
            ${l.map((x) => x.data)}::date[], ${l.map((x) => x.categoria)}::categoria_meta[], ${l.map((x) => x.tipoPreco)}::tipo_preco[],
            ${l.map((x) => x.pais)}::varchar[], ${l.map((x) => x.tier)}::text[], ${l.map((x) => x.volume)}::int[],
            ${l.map((x) => x.custo)}::numeric[], ${l.map((x) => x.moeda)}::text[]) AS u
          ON CONFLICT (numero_id, data, categoria, tipo_preco, pais, tier) DO UPDATE
            SET volume = EXCLUDED.volume, custo = EXCLUDED.custo, moeda = EXCLUDED.moeda, atualizado_em = now()`;
      }
      return total;
    },

    async upsertMensagens(linhas) {
      let total = 0;
      for (let i = 0; i < linhas.length; i += LOTE) {
        const l = linhas.slice(i, i + LOTE);
        total += await db.$executeRaw`
          INSERT INTO mensagens_diarias (companyid, conta_waba_id, numero_id, data, enviadas, entregues, atualizado_em)
          SELECT u.*, now() FROM unnest(
            ${l.map((x) => x.companyid)}::uuid[], ${l.map((x) => x.contaWabaId)}::uuid[], ${l.map((x) => x.numeroId)}::uuid[],
            ${l.map((x) => x.data)}::date[], ${l.map((x) => x.enviadas)}::int[], ${l.map((x) => x.entregues)}::int[]) AS u
          ON CONFLICT (numero_id, data) DO UPDATE
            SET enviadas = EXCLUDED.enviadas, entregues = EXCLUDED.entregues, atualizado_em = now()`;
      }
      return total;
    },

    async consumoAgregado(f) {
      const rs = await db.$queryRaw<
        {
          data: string; numero_id: string; conta_id: string; categoria: CategoriaMeta; tipo_preco: TipoPreco;
          moeda: string; volume: bigint; custo: string | null; sem_custo: bigint;
        }[]
      >`
        SELECT to_char(data, 'YYYY-MM-DD') AS data, numero_id::text, conta_waba_id::text AS conta_id,
               categoria::text AS categoria, tipo_preco::text AS tipo_preco, moeda,
               sum(volume) AS volume, sum(custo)::text AS custo,
               count(*) FILTER (WHERE custo IS NULL) AS sem_custo
        FROM consumo_diario
        WHERE companyid = ${f.companyid}::uuid AND data BETWEEN ${f.de}::date AND ${f.ate}::date ${filtrosOpcionais(f)}
        GROUP BY data, numero_id, conta_waba_id, categoria, tipo_preco, moeda
        ORDER BY data`;
      return rs.map(
        (r): LinhaConsumo => ({
          data: r.data, numeroId: r.numero_id, contaId: r.conta_id, categoria: r.categoria, tipoPreco: r.tipo_preco,
          moeda: r.moeda.trim(), volume: Number(r.volume), custo: r.custo, semCusto: Number(r.sem_custo),
        }),
      );
    },

    async mensagensAgregadas(f) {
      const rs = await db.$queryRaw<{ data: string; numero_id: string; enviadas: bigint; entregues: bigint }[]>`
        SELECT to_char(data, 'YYYY-MM-DD') AS data, numero_id::text, sum(enviadas) AS enviadas, sum(entregues) AS entregues
        FROM mensagens_diarias
        WHERE companyid = ${f.companyid}::uuid AND data BETWEEN ${f.de}::date AND ${f.ate}::date ${filtrosOpcionais(f)}
        GROUP BY data, numero_id
        ORDER BY data`;
      return rs.map(
        (r): LinhaMensagens => ({
          data: r.data, numeroId: r.numero_id, enviadas: Number(r.enviadas), entregues: Number(r.entregues),
        }),
      );
    },
  };
}
