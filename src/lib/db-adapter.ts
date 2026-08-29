import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * يختار محوّل قاعدة البيانات من `DATABASE_URL` وحده.
 *
 * ── لماذا لا يُكتب المحوّل صراحةً ──────────────────────────────────
 * كان كل ملف يستورد محوّل SQLite مباشرة، فالنشر على PostgreSQL يتطلّب
 * تعديل أربعة ملفات يدويًا على الخادم. أخطرها `scripts/create-admin.ts`:
 * وهو أول ما يُشغَّل بعد النشر. لو بقي على SQLite لأنشأ حساب المدير في ملف
 * محلي فارغ بدل قاعدة الإنتاج — بلا رسالة خطأ واحدة — ثم يفشل تسجيل الدخول
 * بلا سبب ظاهر. الاختيار من الرابط يجعل الخطأ مستحيلًا.
 *
 * `provider` في `schema.prisma` يبقى تعديلًا يدويًا واحدًا: Prisma يقرأه
 * وقت توليد الأنواع وبناء الـ migrations، فلا يقبل قيمة من البيئة.
 */
export function createDatabaseAdapter(url: string) {
  if (isPostgres(url)) return new PrismaPg({ connectionString: url });

  if (url.startsWith('file:')) return new PrismaBetterSqlite3({ url });

  throw new Error(
    `DATABASE_URL غير مفهوم: «${url.slice(0, 24)}…». ` +
      'المتوقّع `file:...` لـ SQLite أو `postgresql://...` لـ PostgreSQL.',
  );
}

/** هل الرابط لقاعدة PostgreSQL؟ يقبل الصيغتين الشائعتين */
export function isPostgres(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}
