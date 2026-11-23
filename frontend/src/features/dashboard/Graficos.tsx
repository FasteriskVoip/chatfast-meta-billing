import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { BarChart3, CircleHelp, Coins, MessagesSquare } from 'lucide-react';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { formatarDiaMes } from '@/components/shared/formatos';
import { CARTAO, Segmentado, TituloCartao } from '@/components/shared/visual';
import { Badge } from '@/components/ui/badge';
import { TOM } from '@/components/shared/tons';
import { formatarPreco } from '@/features/admin/tipos';
import { COR_GRUPO, GRUPOS, NOME_GRUPO, semGratis, type Grupo, type Resumo } from './tipos';

/** Barras crescem da base (700ms); a linha se desenha da esquerda pra direita (1000ms). */
const animar = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ANIM_BARRA = { isAnimationActive: animar, animationDuration: 700, animationEasing: 'ease-out' } as const;
const ANIM_LINHA = { isAnimationActive: animar, animationDuration: 1000, animationEasing: 'ease-out' } as const;
const EIXO = { tickLine: false, axisLine: false, fontSize: 11, stroke: '#8A94A6' } as const;
/** Eixo Y legível: 3.800 → "3,8 mil". */
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const eixoY = (v: number) => compacto.format(v);

/** Explicação recolhida: quem precisa abre, quem não precisa não lê um parágrafo a cada gráfico. */
function Nota({ children }: { children: React.ReactNode }) {
  return (
    <details className="text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-slate-500 hover:text-blue-600 [&::-webkit-details-marker]:hidden">
        <CircleHelp className="size-3.5" aria-hidden /> Como ler este gráfico
      </summary>
      <p className="mt-2 rounded-lg bg-slate-50 p-3 leading-relaxed text-slate-500">{children}</p>
    </details>
  );
}

/** Envio e entrega vêm da Meta sem categoria: não seguem esse filtro. Fica explícito pra não parecer que seguem. */
export function SeloTodasCategorias() {
  return (
    <Badge className={TOM.neutro} title="A Meta não separa envio e entrega por categoria, então estes números contam todas.">
      Todas as categorias · a Meta não separa o envio por categoria
    </Badge>
  );
}

const configCategorias = Object.fromEntries(
  GRUPOS.map((g) => [g, { label: NOME_GRUPO[g], color: COR_GRUPO[g] }]),
) satisfies ChartConfig;

/** Com categoria filtrada, os gráficos mostram só ela (as outras viriam zeradas). */
type Foco = { foco?: Grupo | null };
const gruposDe = (foco?: Grupo | null) => (foco ? [foco] : [...GRUPOS]);

export function GraficoCategorias({ resumo, foco }: { resumo: Resumo } & Foco) {
  const [modo, setModo] = useState<'volume' | 'custo'>('volume');
  const grupos = gruposDe(foco);
  const dados = resumo.serieCategorias.map((d) => ({
    dia: formatarDiaMes(d.data),
    ...Object.fromEntries(grupos.map((g) => [g, modo === 'volume' ? d[g].volume : Number(d[g].custoBrl ?? 0)])),
  }));
  const descricao = foco
    ? (modo === 'volume' ? `Mensagens de ${NOME_GRUPO[foco]} em cada dia` : `Custo estimado em R$ de ${NOME_GRUPO[foco]} em cada dia`)
    : (modo === 'volume' ? `Mensagens por categoria em cada dia${semGratis(resumo) ? '' : ' (Serviço é grátis)'}` : 'Custo estimado em R$ por categoria em cada dia');
  return (
    <section className={`${CARTAO} flex h-full flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-md`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TituloCartao icone={BarChart3} titulo={foco ? `${NOME_GRUPO[foco]} por dia` : 'Categorias por dia'} descricao={descricao} />
        <Segmentado rotulo="Mostrar" opcoes={[['volume', 'Volume'], ['custo', 'Custo']] as const} valor={modo} onChange={setModo} />
      </div>
      <div className="flex-1 space-y-3">
        <ChartContainer config={configCategorias} className="aspect-auto h-64 w-full">
          <BarChart data={dados} maxBarSize={48}>
            <CartesianGrid vertical={false} stroke="#EDEFF5" />
            <XAxis dataKey="dia" {...EIXO} />
            <YAxis {...EIXO} width={modo === 'custo' ? 60 : 44} tickFormatter={(v: number) => (modo === 'custo' ? `R$ ${eixoY(v)}` : eixoY(v))} />
            <ChartTooltip cursor={{ fill: '#F4F6FA' }} content={<ChartTooltipContent />} />
            {!foco && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />}
            {grupos.map((g, i) => (
              <Bar key={g} dataKey={g} stackId="a" fill={`var(--color-${g})`} stroke="var(--card)" strokeWidth={1} {...ANIM_BARRA}
                radius={i === grupos.length - 1 ? [4, 4, 0, 0] : 0} />
            ))}
          </BarChart>
        </ChartContainer>
        <Nota>
          {semGratis(resumo) ? (
            <>Contam as mensagens entregues por categoria. Custo: {formatarPreco(resumo.fasterisk!.precoBrl)} por mensagem, todas cobradas.</>
          ) : (
            <>
              Dados do pricing_analytics: contam as mensagens entregues por categoria. Serviço (respostas dentro da janela de 24h) e
              entradas por anúncio são gratuitos. O custo é aproximado, convertido para R$ pela cotação de cada dia, e não vem para
              WABAs que usam a linha de crédito de um parceiro.
              {modo === 'custo' && ' Dias sem custo informado aparecem como zero no gráfico; confira os cards.'}
            </>
          )}
        </Nota>
      </div>
    </section>
  );
}

/** Custo médio por mensagem entregue (custo ÷ volume) de cada categoria, dia a dia. */
export function GraficoCustoPorMensagem({ resumo, foco }: { resumo: Resumo } & Foco) {
  const grupos = gruposDe(foco);
  const dados = resumo.serieCategorias.map((d) => ({
    dia: formatarDiaMes(d.data),
    // Sem volume ou sem custo, o ponto fica vazio (null): custo ausente não vira zero.
    ...Object.fromEntries(grupos.map((g) => [
      g, d[g].volume > 0 && d[g].custoBrl !== null ? Number((Number(d[g].custoBrl) / d[g].volume).toFixed(4)) : null,
    ])),
  }));
  return (
    <section className={`${CARTAO} flex h-full flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-md`}>
      <TituloCartao icone={Coins} titulo={foco ? `Custo por mensagem de ${NOME_GRUPO[foco]}` : 'Custo por mensagem'}
        descricao={foco ? 'Custo médio em R$ de cada mensagem, em cada dia' : 'Custo médio em R$ de cada mensagem, por categoria, em cada dia'} />
      <div className="flex-1 space-y-3">
        <ChartContainer config={configCategorias} className="aspect-auto h-64 w-full">
          <LineChart data={dados}>
            <CartesianGrid vertical={false} stroke="#EDEFF5" />
            <XAxis dataKey="dia" {...EIXO} />
            <YAxis {...EIXO} width={60} tickFormatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {!foco && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />}
            {grupos.map((g) => (
              <Line key={g} type="monotone" dataKey={g} stroke={`var(--color-${g})`} dot={false} strokeWidth={2} connectNulls={false} {...ANIM_LINHA} />
            ))}
          </LineChart>
        </ChartContainer>
        <Nota>
          {semGratis(resumo)
            ? 'Custo do dia dividido pelas mensagens entregues da categoria. Dias sem envio ficam em branco.'
            : 'Custo do dia dividido pelas mensagens entregues da categoria, contando as gratuitas. Por isso Serviço fica abaixo do preço cheio quando parte das mensagens cai na faixa grátis. Dias sem envio ou sem custo ficam em branco.'}
        </Nota>
      </div>
    </section>
  );
}

const configMensagens = {
  enviadas: { label: 'Enviadas', color: 'var(--serie-enviadas)' },
  entregues: { label: 'Entregues', color: 'var(--serie-entregues)' },
} satisfies ChartConfig;

export function GraficoMensagens({ resumo, foco }: { resumo: Resumo } & Foco) {
  const [modo, setModo] = useState<'barras' | 'linha'>('barras');
  const dados = resumo.serieMensagens.map((d) => ({ ...d, dia: formatarDiaMes(d.data) }));
  const eixos = (
    <>
      <CartesianGrid vertical={false} stroke="#EDEFF5" />
      <XAxis dataKey="dia" {...EIXO} />
      <YAxis {...EIXO} width={44} tickFormatter={eixoY} />
      <ChartTooltip cursor={{ fill: '#F4F6FA' }} content={<ChartTooltipContent />} />
      <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
    </>
  );
  return (
    <section className={`${CARTAO} flex h-full flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-md`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <TituloCartao icone={MessagesSquare} titulo="Mensagens por dia" descricao="Enviadas e entregues em cada dia do período" />
          {foco && <SeloTodasCategorias />}
        </div>
        <Segmentado rotulo="Tipo de gráfico" opcoes={[['barras', 'Barras'], ['linha', 'Linha']] as const} valor={modo} onChange={setModo} />
      </div>
      <div className="flex-1 space-y-3">
        <ChartContainer config={configMensagens} className="aspect-auto h-64 w-full">
          {modo === 'barras' ? (
            <BarChart data={dados} maxBarSize={48}>
              {eixos}
              <Bar dataKey="enviadas" fill="var(--color-enviadas)" radius={[4, 4, 0, 0]} {...ANIM_BARRA} />
              <Bar dataKey="entregues" fill="var(--color-entregues)" radius={[4, 4, 0, 0]} {...ANIM_BARRA} />
            </BarChart>
          ) : (
            <LineChart data={dados}>
              {eixos}
              <Line type="monotone" dataKey="enviadas" stroke="var(--color-enviadas)" dot={false} strokeWidth={2} {...ANIM_LINHA} />
              <Line type="monotone" dataKey="entregues" stroke="var(--color-entregues)" dot={false} strokeWidth={2} {...ANIM_LINHA} />
            </LineChart>
          )}
        </ChartContainer>
        <Nota>
          Em alguns dias o número de entregues passa o de enviadas: a Meta conta a entrega no dia em que ela acontece, então
          mensagens enviadas perto da meia-noite podem aparecer como entregues no dia seguinte.
        </Nota>
      </div>
    </section>
  );
}
