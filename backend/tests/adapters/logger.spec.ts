import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { serializarErro, urlSemQuery } from '../../server/logger.js';
import { semSegredos } from '../../server/services/auditoria.service.js';

const TOKEN = 'EAAG-super-secreto-123';

describe('logs sem segredos', () => {
  it('erro do axios perde headers, body e query string', () => {
    const headers = new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` });
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', {
      url: `https://graph.facebook.com/v27.0/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`, method: 'get', headers,
    }, undefined, {
      status: 400, data: { error: { message: `token ${TOKEN}` }, conteudo: 'Olá, 5561999999999' }, headers: {}, statusText: '',
      config: { headers },
    });
    const s = JSON.stringify(serializarErro(err));
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain('access_token');
    expect(s).not.toContain('5561999999999');
    expect(serializarErro(err)).toMatchObject({ metodo: 'GET', url: 'https://graph.facebook.com/v27.0/debug_token', status: 400 });
  });

  it('urlSemQuery', () => {
    expect(urlSemQuery('https://x/y?a=1')).toBe('https://x/y');
  });

  it('auditoria troca token* por ultimos4, inclusive aninhado', () => {
    expect(semSegredos({ token: TOKEN, nome: 'x', sub: { tokenChatfast: 'abcd1234' } })).toEqual({
      token: { ultimos4: '-123' }, nome: 'x', sub: { tokenChatfast: { ultimos4: '1234' } },
    });
  });
});
