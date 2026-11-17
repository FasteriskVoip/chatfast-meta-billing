import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// generate roda no build do Docker sem banco; só migrate precisa da URL.
config({ path: 'backend/.env', quiet: true });

export default defineConfig({
  schema: 'backend/prisma/schema.prisma',
  migrations: { path: 'backend/prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
