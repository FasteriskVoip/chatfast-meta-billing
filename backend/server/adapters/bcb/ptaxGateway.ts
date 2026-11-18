import axios, { type AxiosInstance } from 'axios';
import { ErroIndisponivel } from '../../domain/ports/erros.js';
import type { FonteCotacao } from '../../domain/ports/FonteCotacao.js';

const URL_PTAX =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/' +
  'CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)';

/** 'AAAA-MM-DD' → 'MM-DD-AAAA' (formato que a API do BCB pede). */
const paraBcb = (iso: string) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`;

interface RespostaPtax {
  value?: { cotacaoVenda: number; dataHoraCotacao: string }[];
}

/**
 * PTAX de venda do Banco Central (API pública, sem token). Um registro por dia útil, publicado por volta das 13h;
 * fim de semana e feriado não vêm (vale a do último dia útil, como no cadastro manual).
 */
export function criarPtaxGateway(http: AxiosInstance = axios.create()): FonteCotacao {
  return {
    async dolarVenda(de, ate) {
      try {
        const r = await http.get<RespostaPtax>(URL_PTAX, {
          timeout: 15_000,
          params: {
            '@dataInicial': `'${paraBcb(de)}'`,
            '@dataFinalCotacao': `'${paraBcb(ate)}'`,
            $top: 1000,
            $format: 'json',
            $select: 'cotacaoVenda,dataHoraCotacao',
          },
        });
        // Se houver mais de um boletim no dia, fica o último (o fechamento).
        const porDia = new Map<string, string>();
        for (const p of r.data.value ?? []) porDia.set(p.dataHoraCotacao.slice(0, 10), p.cotacaoVenda.toFixed(4));
        return [...porDia].map(([data, valor]) => ({ data, valor }));
      } catch {
        throw new ErroIndisponivel('Banco Central (PTAX) indisponível');
      }
    },
  };
}
