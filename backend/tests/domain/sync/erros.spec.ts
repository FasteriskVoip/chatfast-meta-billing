import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { traduzirErroMeta } from '../../../server/adapters/meta/metaGraphGateway.js';
import { ErroIndisponivel, ErroLimite, ErroToken } from '../../../server/domain/ports/erros.js';
import { deveRetentar, mensagemErro, statusPorErro } from '../../../server/domain/sync/erros.js';

const axiosErro = (status: number, code?: number, type = 'OAuthException') =>
  new AxiosError('x', 'E', undefined, undefined, {
    status, data: code === undefined ? {} : { error: { code, type, message: 'm' } }, headers: {}, statusText: '',
    config: { headers: new AxiosHeaders() },
  });

describe('mapeamento de erros da Meta', () => {
  it.each([190, 102, 463, 467])('código %i → ErroToken → TOKEN_INVALIDO sem retry', (code) => {
    const e = traduzirErroMeta(axiosErro(400, code));
    expect(e).toBeInstanceOf(ErroToken);
    expect(statusPorErro(e)).toBe('TOKEN_INVALIDO');
    expect(deveRetentar(e, 0)).toBe(false);
  });

  it.each([4, 80007, 80008])('código %i → ErroLimite, retry até 3 vezes, depois ERRO_SYNC', (code) => {
    const e = traduzirErroMeta(axiosErro(400, code));
    expect(e).toBeInstanceOf(ErroLimite);
    expect([0, 1, 2, 3].map((t) => deveRetentar(e, t))).toEqual([true, true, true, false]);
    expect(statusPorErro(e)).toBe('ERRO_SYNC');
    expect(mensagemErro(e)).toContain('Limite');
  });

  it('5xx/timeout → ErroIndisponivel → ERRO_SYNC', () => {
    const e = traduzirErroMeta(axiosErro(503));
    expect(e).toBeInstanceOf(ErroIndisponivel);
    expect(statusPorErro(e)).toBe('ERRO_SYNC');
    const semResposta = new AxiosError('timeout', 'ECONNABORTED');
    expect(traduzirErroMeta(semResposta)).toBeInstanceOf(ErroIndisponivel);
  });

  it('outro 4xx não é token nem retry', () => {
    const e = traduzirErroMeta(axiosErro(400, 100, 'GraphMethodException'));
    expect(e).not.toBeInstanceOf(ErroToken);
    expect(deveRetentar(e, 0)).toBe(false);
    expect(statusPorErro(e)).toBe('ERRO_SYNC');
  });
});
