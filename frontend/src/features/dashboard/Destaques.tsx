import { CalendarDays, CheckCheck, Gauge, Info, Receipt, Send, TrendingUp, Wallet } from 'lucide-react';
import { formatarBRL, formatarData, formatarNumero, formatarPercentual } from '@/components/shared/formatos';
import { TOM } from '@/components/shared/tons';
import { Kpi } from '@/components/shared/visual';
import { formatarPreco } from '@/features/admin/tipos';
import { Custo } from './Custo';
import { NOME_GRUPO, semGratis, type Grupo, type Resumo } from './tipos';

const inteiro = (n: number) => formatarNumero(Math.round(n));

/** O custo é a primeira pergunta do cliente: vem em destaque; envio e entrega ao lado. */
export function Destaques({ resumo, foco }: { resumo: Resumo; foco?: Grupo | null }) {
  const { envio, periodo, total } = resumo;
  const gratuitas = total.volume - total.cobradas;
  const taxi = semGratis(resumo);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <section aria-label="Custo do período" className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 p-6 text-white shadow-sm">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/80 uppercase">
            <Wallet className="size-4" aria-hidden /> {foco ? `Custo de ${NOME_GRUPO[foco]} no período` : 'Custo estimado no período'}
          </p>
          <p className="text-4xl leading-tight font-bold tabular-nums [&_svg]:text-white/80">
            <Custo valor={total.custoBrl} situacao={total.custoSituacao} diasSemCusto={total.diasSemCusto} />
          </p>
          <p className="text-xs text-white/80">{formatarData(periodo.de)} a {formatarData(periodo.ate)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-white/10 p-3 text-sm">
          <div>
            <dt className="text-[11px] text-white/70">Por mensagem cobrada</dt>
            <dd className="font-semibold tabular-nums">{formatarBRL(total.custoMedioPorCobradaBrl)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-white/70">{taxi ? 'Mensagens cobradas' : 'Cobradas · grátis'}</dt>
            <dd className="font-semibold tabular-nums">{formatarNumero(total.cobradas)}{!taxi && ` · ${formatarNumero(gratuitas)}`}</dd>
          </div>
        </dl>
        <p className="text-[10px] leading-snug text-white/70">
          {resumo.custo === 'fasterisk' && resumo.fasterisk ? (
            <>{formatarPreco(resumo.fasterisk.precoBrl)} por mensagem. Todas as mensagens são cobradas.</>
          ) : (
            <>
              Convertido para R$ pela cotação de cada dia
              {total.convertidoComCotacaoPosterior && ' · parte com cotação posterior'}. Valor aproximado: a cobrança oficial é a fatura da Meta.
            </>
          )}
        </p>
      </section>

      <section
        aria-label="Envio e entrega"
        className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm xl:grid-cols-3 [&>*]:bg-card`}
      >
        <Kpi icone={Send} tom={TOM.marca} rotulo="Enviadas" valor={envio.enviadas} formatar={inteiro}
          detalhe={`${formatarNumero(Math.round(envio.mediaDiaria))} por dia em média`} />
        <Kpi icone={CheckCheck} tom={TOM.sucesso} rotulo="Entregues" valor={envio.entregues} formatar={inteiro}
          detalhe={`${formatarNumero(envio.naoEntregues)} não entregues`} />
        <Kpi icone={Gauge} tom={TOM.sucesso} rotulo="Taxa de entrega" valor={envio.taxaEntrega} formatar={(n) => formatarPercentual(n)}
          detalhe="das enviadas chegaram" corValor="text-ok-texto" />
        {/* Com categoria filtrada, cobradas/grátis já estão no cartão de custo; o resto aqui não segue o filtro. */}
        {!foco && (
          <Kpi icone={Receipt} tom={TOM.marca} rotulo="Mensagens cobradas" valor={total.cobradas} formatar={inteiro}
            detalhe={taxi ? 'todas as mensagens do período' : `${formatarNumero(gratuitas)} foram grátis`} />
        )}
        <Kpi icone={TrendingUp} tom={TOM.aviso} rotulo="Dia de pico" valor={envio.pico?.enviadas ?? null} formatar={inteiro}
          detalhe={envio.pico ? `enviadas em ${formatarData(envio.pico.data)}` : 'sem envios'} />
        <Kpi icone={CalendarDays} tom={TOM.neutro} rotulo="Dias com envio" valor={envio.diasComEnvio} formatar={inteiro}
          detalhe={`de ${envio.diasNoPeriodo} ${envio.diasNoPeriodo === 1 ? 'dia' : 'dias'} no período`} />
        {foco && (
          <div className="flex items-start gap-2 p-4 text-xs leading-relaxed text-slate-500 sm:p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p>
              Envio e entrega contam <b className="font-semibold text-slate-700">todas as categorias</b> (a Meta não os separa).
              Custo e cobradas: só {NOME_GRUPO[foco]}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
