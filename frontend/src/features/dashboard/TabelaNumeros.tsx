import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROTULO_QUALIDADE } from '@/components/shared/tons';
import { formatarBRL, formatarNumero, formatarPercentual } from '@/components/shared/formatos';
import { CARTAO, TituloCartao } from '@/components/shared/visual';
import { Vazio } from '@/components/shared/Vazio';
import { COR_GRUPO, GRUPOS, NOME_GRUPO, type Grupo, type Resumo } from './tipos';

export function TabelaNumeros({ resumo, foco }: { resumo: Resumo; foco?: Grupo | null }) {
  // Com categoria filtrada: só a coluna dela, ordenada por ela; enviadas/entregues/taxa saem (não seguem o filtro).
  const grupos = foco ? [foco] : GRUPOS;
  const linhas = foco ? [...resumo.porNumero].sort((a, b) => b.porCategoria[foco] - a.porCategoria[foco]) : resumo.porNumero;
  return (
    <section className={`${CARTAO} break-before-page overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <TituloCartao icone={Phone} titulo="Consumo por número"
          descricao={foco ? `Mensagens e custo de ${NOME_GRUPO[foco]} por número, do maior para o menor.` : 'Quanto cada número enviou, entregou e custou no período.'} />
        <Badge className="bg-slate-100 text-slate-500 tabular-nums">{linhas.length} número(s)</Badge>
      </div>
      {linhas.length === 0 ? (
        <div className="border-t border-slate-100"><Vazio icone={Phone} texto="Nenhum número com consumo no período." /></div>
      ) : (
        <div className="border-t border-slate-100">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">WABA</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Nome verificado</TableHead>
                <TableHead>Qualidade</TableHead>
                {!foco && (
                  <>
                    <TableHead className="text-right">Enviadas</TableHead>
                    <TableHead className="text-right">Entregues</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                  </>
                )}
                {grupos.map((g) => (
                  <TableHead key={g} className="text-right">
                    <span className="mr-1 inline-block size-2 rounded-full" style={{ background: COR_GRUPO[g] }} aria-hidden />
                    {NOME_GRUPO[g]}
                  </TableHead>
                ))}
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="pr-5">% do total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((n, i) => {
                const q = ROTULO_QUALIDADE[n.qualidade] ?? ROTULO_QUALIDADE.UNKNOWN!;
                return (
                  <TableRow key={n.numeroId} className={`entrar ${foco && !n.porCategoria[foco] ? 'opacity-50' : ''}`} style={{ animationDelay: `${200 + i * 50}ms` }}>
                    <TableCell className="pl-5 text-slate-500">{n.conta}</TableCell>
                    <TableCell className="font-semibold text-slate-800 tabular-nums">{n.display}</TableCell>
                    <TableCell className="text-slate-600">{n.nomeVerificado ?? '—'}</TableCell>
                    <TableCell><Badge className={q.cls}>{q.texto}</Badge></TableCell>
                    {!foco && (
                      <>
                        <TableCell className="text-right tabular-nums">{formatarNumero(n.enviadas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatarNumero(n.entregues)}</TableCell>
                        <TableCell className="text-right text-ok-texto tabular-nums">{formatarPercentual(n.taxaEntrega)}</TableCell>
                      </>
                    )}
                    {grupos.map((g) => <TableCell key={g} className={`text-right tabular-nums ${foco ? 'font-semibold text-slate-800' : ''}`}>{formatarNumero(n.porCategoria[g])}</TableCell>)}
                    <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatarBRL(n.custoBrl)}</TableCell>
                    <TableCell className="min-w-32 pr-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <div className="crescer h-full rounded-full bg-blue-600" style={{ width: `${Math.round(n.percentualDoTotal * 100)}%`, animationDelay: `${300 + i * 60}ms` }} />
                        </div>
                        <span className="w-12 text-right text-slate-500 tabular-nums">{formatarPercentual(n.percentualDoTotal)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
