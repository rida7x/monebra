import { PrismaClient } from '@/generated/prisma/client';
import { createDatabaseAdapter } from '@/lib/db-adapter';

/**
 * Prisma client singleton.
 *
 * في وضع التطوير يعيد Next.js تحميل الوحدات عند كل تعديل، ما ينشئ اتصالات
 * جديدة في كل مرة. نخزّن العميل على globalThis لتفادي استنزاف الاتصالات.
 *
 * الانتقال إلى PostgreSQL: غيّر `DATABASE_URL` و`provider` في
 * `schema.prisma` — لا تعديل في الكود. المحوّل يُختار من الرابط، انظر
 * `db-adapter.ts`.
 */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL غير معرّف. انسخ .env.example إلى .env وعبّئ القيم.',
  );
}

function createPrismaClient() {
  const adapter = createDatabaseAdapter(databaseUrl!);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientSingleton;
};

export const prisma: PrismaClientSingleton =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
