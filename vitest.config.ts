import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['backend/tests/**/*.spec.ts'],
          // env.ts valida no import; nos testes não há banco real.
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://teste:teste@localhost:5432/teste',
            CHAVE_CRIPTOGRAFIA: Buffer.alloc(32, 7).toString('base64'),
            SEGREDO_SESSAO: 'segredo-de-teste-com-mais-de-32-caracteres',
            ADMIN_COMPANYIDS: '00000000-0000-4000-8000-00000000fa57',
          },
        },
      },
      {
        resolve: { alias: { '@': fileURLToPath(new URL('./frontend/src', import.meta.url)) } },
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['frontend/src/**/*.spec.tsx', 'frontend/src/**/*.spec.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
