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
/**
 * إعدادات مسبح PostgreSQL — مضبوطة لاستضافة بلا حالة (دوال Netlify).
 *
 * ⚠️ `connection_limit=1` المكتوب في `DATABASE_URL` **لا أثر له هنا**: إنه
 * وسيط محرّك Prisma القديم، أما محوّل `pg` فيقرأ إعداداته من الكائن ولا
 * يلتفت إلى الرابط. وافتراضي `pg` عشرة اتصالات لكل مسبح.
 *
 * وSession pooler على خطة Supabase المجانية يقبل **١٥ جلسة للمشروع كله**،
 * وكل جلسة تُحجز طوال عمرها لا طوال الاستعلام. وNetlify تشغّل نسخًا
 * متعددة من الدالة، لكلٍّ مسبحها. فبثلاثة اتصالات لكل نسخة تكفي خمس نسخ
 * لإسقاط المتجر كله بـ:
 *   `(EMAXCONNSESSION) max clients reached in session mode`
 * وأثره أن الصفحات التي تقرأ من القاعدة ترجع 500 بينما الصفحات الثابتة
 * تعمل — فيبدو المتجر «نصف شغّال» بلا سبب ظاهر.
 *
 * `max: 1` — نسخة الدالة تخدم طلبًا واحدًا في اللحظة أصلًا، فالثاني ترف.
 * `idleTimeoutMillis` — الأهم: بدونه يبقى الاتصال محجوزًا ما دامت النسخة
 * حيّة (دقائق بعد آخر طلب). عشر ثوانٍ تعيده إلى المسبح فيجد غيرُه مكانًا.
 * `connectionTimeoutMillis` — عند الازدحام نفشل بسرعة برسالة مفهومة بدل
 * أن يتجمّد الطلب حتى تقتله Netlify بلا أثر في السجل.
 *
 * إن كبر المتجر وتكرّر الخطأ رغم هذا: ارفع `Pool Size` من لوحة Supabase
 * (Settings ← Database ← Connection pooling) — هذا هو الحلّ الذي يتوسّع،
 * لا إنقاص الأرقام هنا أكثر.
 */
const POOL = {
  max: 1,
  /**
   * ثانيتان لا عشر. الفرق ليس ضبطًا دقيقًا بل حدّ بين متجر يعمل وآخر لا:
   * عشر طلبات متزامنة تُشغّل عشر نسخ، فإن بقيت جلسة كل نسخة محجوزة عشر
   * ثوانٍ بعد فراغها تراكمت جلسات النسخ المنتهية فوق العاملة وتجاوز
   * المجموع الخمس عشرة. قيست فعلًا: عشر ثوانٍ ⇒ فشل ٣ من ١٠.
   */
  idleTimeoutMillis: 2_000,
  connectionTimeoutMillis: 15_000,
  // لا تُبقِ النسخة حيّة لأجل مسبح فارغ
  allowExitOnIdle: true,
} as const;

export function createDatabaseAdapter(url: string) {
  if (isPostgres(url)) {
    return new PrismaPg({ connectionString: url, ...POOL });
  }

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
