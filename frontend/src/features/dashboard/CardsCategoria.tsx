import type { ReactNode } from 'react';
import { CircleHelp, Layers, Megaphone, MessageCircle, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatarNumero, formatarPercentual } from '@/components/shared/formatos';
import { TOM } from '@/components/shared/tons';
import { CARTAO, TituloCartao, atraso, useContagem } from '@/components/shared/visual';
import { Custo } from './Custo';
import { COR_GRUPO, NOME_GRUPO, type Grupo, type Resumo } from './tipos';

const ICONE: Record<Grupo, typeof Megaphone> = { MARKETING: Megaphone, UTILITY: Wrench, AUTHENTICATION: ShieldCheck, SERVICE: MessageCircle };

/** O que cada categoria significa, para quem não conhece a tabela da Meta. */
const EXPLICA: Record<Grupo, string> = {
  MARKETING: 'Promoções, ofertas, novidades e convites enviados pela empresa. É a categoria mais cara.',
  UTILITY: 'Avisos sobre algo que o cliente já pediu: confirmação de pedido, entrega, cobrança.',
  AUTHENTICATION: 'Códigos de verificação e de acesso (senha de uso único).',
  SERVICE: 'Respostas da empresa dentro de 24h depois que o cliente mandou mensagem. São gratuitas.',
};

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{rotulo}</span>
      <span className="font-semibold text-slate-700 tabular-nums">{children}</span>
    </div>
  );
}

function Volume({ valor }: { valor: number }) {
  const animado = useContagem(valor);
  return <p className="text-2xl font-semibold text-slate-800 tabular-nums">{formatarNumero(Math.round(animado))}</p>;
}

/** Categoria filtrada: um cartão largo com a explicação à vista, em vez de 4 cartões com 3 zerados. */
function CartaoFoco({ resumo, foco }: { resumo: Resumo; foco: Grupo }) {
  const c = resumo.categorias.find((x) => x.categoria === foco)!;
  const cor = COR_GRUPO[foco];
  const Icone = ICONE[foco];
  const gratis = c.volume > 0 && c.cobradas === 0;
  return (
    <section style={atraso(3)} className={`entrar ${CARTAO} overflow-hidden`}>
      <div className="h-1" style={{ background: cor }} aria-hidden />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${cor} 12%, white)`, color: cor }}>
            <Icone className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-800">
              Filtrando por {NOME_GRUPO[foco]}
              {gratis && <Badge className={TOM.sucesso}>Grátis</Badge>}
            </p>
            <p className="text-xs leading-relaxed text-slate-500">{EXPLICA[foco]}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 sm:grid-cols-4 [&>div]:bg-card [&>div]:p-4">
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Mensagens</dt>
            <dd><Volume valor={c.volume} /></dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Cobradas</dt>
            <dd className="text-xl font-semibold text-slate-800 tabular-nums sm:text-2xl">{formatarNumero(c.cobradas)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Grátis</dt>
            <dd className="text-xl font-semibold text-slate-800 tabular-nums sm:text-2xl">{formatarNumero(c.gratuitas)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Custo</dt>
            <dd className="text-xl font-semibold text-slate-800 sm:text-2xl">
              {gratis ? <span className="text-ok-texto">sem custo</span> : <Custo valor={c.custoBrl} situacao={c.custoSituacao} />}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function CardsCategoria({ resumo, foco }: { resumo: Resumo; foco?: Grupo | null }) {
  if (foco) return <CartaoFoco resumo={resumo} foco={foco} />;
  return (
    <section className="space-y-3">
      <TituloCartao icone={Layers} titulo="Por categoria de cobrança" descricao="A Meta cobra cada conversa conforme o tipo de mensagem." />
      {/* Celular: carrossel com encaixe (4 cartões empilhados viravam meia página). Daí pra cima: grade. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        {resumo.categorias.map((c, i) => {
          const cor = COR_GRUPO[c.categoria];
          const Icone = ICONE[c.categoria];
          const gratis = c.volume > 0 && c.cobradas === 0;
          return (
            <article key={c.categoria} style={atraso(i + 3)} className={`entrar ${CARTAO} w-[78%] shrink-0 snap-start space-y-3 p-5 erguer sm:w-auto`}>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${cor} 12%, white)`, color: cor }}>
                  <Icone className="size-4" aria-hidden />
                </span>
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{NOME_GRUPO[c.categoria]}</p>
                <Tooltip>
                  <TooltipTrigger aria-label={`O que é ${NOME_GRUPO[c.categoria]}?`} className="rounded-full text-slate-400 hover:text-blue-600">
                    <CircleHelp className="size-3.5" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{EXPLICA[c.categoria]}</TooltipContent>
                </Tooltip>
                {gratis && <Badge className={`ml-auto ${TOM.sucesso}`}>Grátis</Badge>}
              </div>
              <div>
                <Volume valor={c.volume} />
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="crescer h-full rounded-full" style={{ width: `${Math.round(c.percentual * 100)}%`, background: cor, animationDelay: `${(i + 3) * 60 + 200}ms` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatarPercentual(c.percentual)} das mensagens</p>
              </div>
              <div className="space-y-1 border-t border-slate-100 pt-3">
                <Linha rotulo="Custo">{gratis ? <span className="text-ok-texto">sem custo</span> : <Custo valor={c.custoBrl} situacao={c.custoSituacao} />}</Linha>
                <Linha rotulo="Cobradas">{formatarNumero(c.cobradas)}</Linha>
                <Linha rotulo="Grátis">{formatarNumero(c.gratuitas)}</Linha>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
