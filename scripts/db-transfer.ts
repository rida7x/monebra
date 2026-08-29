import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabaseAdapter, isPostgres } from '../src/lib/db-adapter.js';

/**
 * نقل محتوى قاعدة البيانات بين مزوّدين.
 *
 *   npm run db:export                 ← من القاعدة الحالية إلى ملف
 *   DATABASE_URL="postgres://…" npm run db:import
 *
 * ── لماذا لا تكفي `prisma migrate` ─────────────────────────────────
 * الترحيلات تنقل **المخطّط** لا البيانات. وترحيلات SQLite لا تعمل على
 * PostgreSQL أصلًا (أنواع مختلفة)، فالمعتاد حذفها وبناء واحدة جديدة — وعندها
 * تبقى القاعدة الجديدة فارغة تمامًا: لا إعدادات ولا مدن ولا منتجات ولا حساب
 * مدير. هذا السكربت ينقل الصفوف نفسها.
 *
 * ⚠️ الترتيب أدناه ليس أبجديًا بل ترتيب المفاتيح الأجنبية: لا يُدرج صفّ قبل
 * ما يشير إليه. تغييره يُنتج أخطاء قيود يصعب تفسيرها.
 */

/** الجداول بترتيب الإدراج الآمن */
const TABLES = [
  // لا تعتمد على غيرها
  'setting',
  'counter',
  'city',
  'category',
  'inspirationBrand',
  'tag',
  'adminUser',
  'heroSlide',
  'contentPage',
  'customer',
  'coupon',
  'promotion',
  // تعتمد على ما فوقها
  'area',
  'address',
  'product',
  'productImage',
  'productVariant',
  'productNote',
  'productTag',
  'bundleItem',
  'couponTarget',
  'promotionTarget',
  'order',
  'orderItem',
  'orderStatusHistory',
  'couponUsage',
  'inventoryMovement',
  'review',
  'notification',
  'analyticsEvent',
  'errorLog',
  'loginAttempt',
] as const;

/**
 * جداول لا تُنقل عمدًا:
 *   adminSession — الجلسات مرتبطة بخادم ووقت؛ نقلها يعني نقل جلسات مفتوحة
 *   rateLimit    — عدّادات لحظية تنتهي خلال دقائق
 */

const FILE = 'data-export.json';

type Row = Record<string, unknown>;
type Dump = { exportedAt: string; source: string; tables: Record<string, Row[]> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL غير معرّف');
  return {
    url,
    prisma: new PrismaClient({ adapter: createDatabaseAdapter(url) }),
  };
}

async function exportData() {
  const { prisma, url } = client();
  const tables: Record<string, Row[]> = {};
  let total = 0;

  try {
    for (const name of TABLES) {
      const model = (prisma as unknown as Record<string, { findMany: () => Promise<Row[]> }>)[name];
      if (!model) {
        console.log(`  – ${name}: غير موجود في المخطّط، تخطّي`);
        continue;
      }

      const rows = await model.findMany();
      tables[name] = rows;
      total += rows.length;
      if (rows.length > 0) console.log(`  ✓ ${name}: ${rows.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  const dump: Dump = {
    exportedAt: new Date().toISOString(),
    source: isPostgres(url) ? 'postgresql' : 'sqlite',
    tables,
  };

  await writeFile(FILE, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`\n✓ ${total} صفًا إلى ${FILE}`);
  console.log('  انقل الملف إلى الخادم ثم شغّل: npm run db:import');
}

async function importData() {
  const raw = await readFile(FILE, 'utf8').catch(() => null);
  if (!raw) throw new Error(`${FILE} غير موجود — شغّل npm run db:export أولًا`);

  const dump = JSON.parse(raw) as Dump;
  const { prisma, url } = client();

  console.log(`الوجهة: ${isPostgres(url) ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`المصدر: ${dump.source} — ${dump.exportedAt.slice(0, 16)}\n`);

  let total = 0;

  try {
    for (const name of TABLES) {
      const rows = dump.tables[name];
      if (!rows || rows.length === 0) continue;

      const model = (prisma as unknown as Record<
        string,
        { createMany: (args: { data: Row[]; skipDuplicates?: boolean }) => Promise<{ count: number }> }
      >)[name];

      if (!model) {
        console.log(`  – ${name}: غير موجود في المخطّط، تخطّي`);
        continue;
      }

      // `skipDuplicates` يجعل إعادة التشغيل بعد فشل جزئي آمنة بدل أن تنهار
      // على أول مفتاح مكرر
      const { count } = await model.createMany({ data: rows, skipDuplicates: true });
      total += count;
      console.log(`  ✓ ${name}: ${count}${count < rows.length ? ` (تُخطّي ${rows.length - count} موجودًا)` : ''}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n✓ أُدرج ${total} صفًا.`);
  console.log('  تذكّر: الجلسات وعدّادات المعدّل لا تُنقل — سجّل الدخول من جديد.');
}

const mode = process.argv[2];

if (mode === 'export') {
  await exportData();
} else if (mode === 'import') {
  await importData();
} else {
  console.error('الاستخدام: tsx scripts/db-transfer.ts <export|import>');
  process.exit(1);
}
