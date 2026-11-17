import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Cifra } from '../../domain/ports/Cifra.js';

/** AES-256-GCM: IV aleatório por registro e tag gravada junto ("iv.tag.dado" em base64). */
export function criarCifraAesGcm(chaveBase64: string): Cifra {
  const chave = Buffer.from(chaveBase64, 'base64');
  if (chave.length !== 32) throw new Error('CHAVE_CRIPTOGRAFIA deve ter 32 bytes');
  return {
    cifrar(texto) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', chave, iv);
      const dado = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
      return [iv, c.getAuthTag(), dado].map((b) => b.toString('base64')).join('.');
    },
    decifrar(cifrado) {
      const [iv, tag, dado] = cifrado.split('.').map((p) => Buffer.from(p, 'base64'));
      if (!iv || !tag || !dado) throw new Error('cifrado em formato inválido');
      const d = createDecipheriv('aes-256-gcm', chave, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(dado), d.final()]).toString('utf8');
    },
  };
}

export const ultimos4 = (texto: string) => texto.slice(-4);
