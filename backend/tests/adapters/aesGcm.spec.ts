import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { criarCifraAesGcm, ultimos4 } from '../../server/adapters/cripto/aesGcm.js';

const chave = randomBytes(32).toString('base64');

describe('aesGcm', () => {
  const cifra = criarCifraAesGcm(chave);

  it('ida e volta', () => {
    expect(cifra.decifrar(cifra.cifrar('EAAG-token-secreto'))).toBe('EAAG-token-secreto');
  });

  it('IV aleatório: dois cifrados do mesmo texto diferem', () => {
    expect(cifra.cifrar('abc')).not.toBe(cifra.cifrar('abc'));
  });

  it('cifra adulterada falha', () => {
    const [iv, tag, dado] = cifra.cifrar('segredo').split('.');
    const adulterado = Buffer.from(dado!, 'base64');
    adulterado[0] = adulterado[0]! ^ 0xff;
    expect(() => cifra.decifrar([iv, tag, adulterado.toString('base64')].join('.'))).toThrow();
  });

  it('chave errada falha', () => {
    const outra = criarCifraAesGcm(randomBytes(32).toString('base64'));
    expect(() => outra.decifrar(cifra.cifrar('segredo'))).toThrow();
  });

  it('chave com tamanho errado é recusada', () => {
    expect(() => criarCifraAesGcm(randomBytes(16).toString('base64'))).toThrow();
  });

  it('ultimos4', () => {
    expect(ultimos4('EAAGabcd1234')).toBe('1234');
  });
});
