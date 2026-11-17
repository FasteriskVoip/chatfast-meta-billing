import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { env } from '../../../config/env.js';

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
export type Prisma = typeof prisma;

/** 'YYYY-MM-DD' ↔ coluna date (o Prisma devolve meia-noite UTC). */
export const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const deData = (d: Date) => d.toISOString().slice(0, 10);
export const deDataNula = (d: Date | null) => (d ? deData(d) : null);
