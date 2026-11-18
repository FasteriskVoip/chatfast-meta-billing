import { describe, expect, it } from 'vitest';
import { lerEnv } from '../../server/config/env.js';

const base = { DATABASE_URL: 'postgresql://x:y@localhost/z', CHAVE_CRIPTOGRAFIA: Buffer.alloc(32).toString('base64') };
const A = '51c9f8bc-cdde-4942-80e3-f63085e4ecbf';
const B = 'de6d1972-a08c-4c4f-8eef-bd8ac601fe8b';

describe('ADMIN_COMPANYIDS', () => {
  it.each([
    ['vírgula', `${A},${B}`],
    ['vírgula e espaço', `${A}, ${B}`],
    ['ponto e vírgula', `${A};${B}`],
    ['espaço', `${A} ${B}`],
    ['quebra de linha', `${A}\n${B}`],
    ['aspas e maiúsculas', `"${A.toUpperCase()}", '${B}'`],
  ])('aceita %s', (_, valor) => {
    expect(lerEnv({ ...base, ADMIN_COMPANYIDS: valor }).ADMIN_COMPANYIDS).toEqual([A, B]);
  });

  it('vazio = nenhum admin', () => {
    expect(lerEnv({ ...base, ADMIN_COMPANYIDS: '' }).ADMIN_COMPANYIDS).toEqual([]);
  });

  it('valor que não é UUID continua barrado (erro claro na subida)', () => {
    expect(() => lerEnv({ ...base, ADMIN_COMPANYIDS: 'fasterisk' })).toThrow(/ADMIN_COMPANYIDS/);
  });
});
