import { describe, expect, it } from 'vitest';
import { VALIDADE_SESSAO_MS, emitirSessao, verificarSessao } from '../../server/adapters/http/sessao.js';

const SEGREDO = 'x'.repeat(40);
const dados = { cid: '11111111-1111-4111-8111-111111111111', uid: 'agente-1', nome: 'Ana', admin: false };

describe('token de sessão', () => {
  it('emite e verifica', () => {
    const { token, exp } = emitirSessao(dados, SEGREDO, 1000);
    expect(exp).toBe(1000 + VALIDADE_SESSAO_MS);
    expect(verificarSessao(token, SEGREDO, 2000)).toEqual({ ...dados, exp });
  });

  it('assinatura adulterada é inválida', () => {
    const { token } = emitirSessao(dados, SEGREDO);
    const [corpo, assinatura] = token.split('.');
    const trocada = assinatura!.slice(0, -1) + (assinatura!.endsWith('A') ? 'B' : 'A');
    expect(verificarSessao(`${corpo}.${trocada}`, SEGREDO)).toBeNull();
  });

  it('payload adulterado com a mesma assinatura é inválido', () => {
    const { token } = emitirSessao(dados, SEGREDO);
    const [, assinatura] = token.split('.');
    const corpoAdmin = Buffer.from(JSON.stringify({ ...dados, admin: true, exp: Date.now() + 1e6 })).toString('base64url');
    expect(verificarSessao(`${corpoAdmin}.${assinatura}`, SEGREDO)).toBeNull();
  });

  it('segredo diferente é inválido', () => {
    expect(verificarSessao(emitirSessao(dados, SEGREDO).token, 'y'.repeat(40))).toBeNull();
  });

  it('vencido é inválido', () => {
    const { token } = emitirSessao(dados, SEGREDO, 0);
    expect(verificarSessao(token, SEGREDO, VALIDADE_SESSAO_MS + 1)).toBeNull();
  });

  it('ausente ou malformado é inválido', () => {
    expect(verificarSessao(undefined, SEGREDO)).toBeNull();
    expect(verificarSessao('lixo', SEGREDO)).toBeNull();
  });
});
