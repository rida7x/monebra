import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * تحديد معدّل الطلبات — في قاعدة البيانات.
 *
 * يحمي من الطلبات الوهمية المتكررة ومن تخمين أرقام التتبّع وكلمات المرور.
 *
 * ⚠️ لماذا ليس في الذاكرة: كانت العدّادات في `new Map()`، وهو صحيح على
 * خادم واحد دائم. لكن على استضافة بلا حالة (Netlify وأمثالها) تُشغَّل نسخ
 * متعددة وتُطفأ باستمرار، فيبدأ كل طلب تقريبًا بعدّاد صفر — أي أن الحماية
 * تبدو قائمة في الكود وهي **معطّلة فعليًا**. الجدول يجعل العدّاد مشتركًا
 * بين كل النسخ.
 *
 * ⚠️ ليس بديلًا عن التحقق من الصلاحيات: هو طبقة إضافية فقط.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** تنظيف الصفوف المنتهية — واحد من كل مئة طلب يكفي */
const CLEANUP_CHANCE = 0.01;

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    // معاملة واحدة: القراءة والزيادة معًا، وإلا تسلّل طلبان متزامنان فوق
    // الحدّ بقراءة نفس العدّاد قبل أن يكتبه أحدهما
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimit.findUnique({ where: { key } });

      // لا صفّ، أو صفّ انتهت نافذته: نافذة جديدة
      if (!existing || existing.expiresAt <= now) {
        await tx.rateLimit.upsert({
          where: { key },
          create: { key, count: 1, expiresAt },
          update: { count: 1, expiresAt },
        });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      if (existing.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000),
          ),
        };
      }

      const updated = await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
        select: { count: true },
      });

      return {
        allowed: true,
        remaining: Math.max(0, limit - updated.count),
        retryAfterSeconds: 0,
      };
    });

    if (Math.random() < CLEANUP_CHANCE) {
      // لا ننتظره ولا نُفشل الطلب بسببه — التنظيف ترتيب لا وظيفة
      void prisma.rateLimit
        .deleteMany({ where: { expiresAt: { lte: now } } })
        .catch(() => {});
    }

    return result;
  } catch {
    /**
     * ⚠️ قرار متعمّد: عند تعذّر الوصول لقاعدة البيانات نسمح بالطلب.
     *
     * المنع كان سيوقف المتجر بالكامل عن كل زائر لمجرد تعثّر عدّاد — والعملية
     * التي خلف هذا الحدّ لها حراسها الحقيقيون على أي حال: التحقق من الصلاحية،
     * وعدّ محاولات الدخول الفاشلة في `login_attempts`، والتحقق من المخزون.
     * وإن كانت القاعدة معطّلة فلن ينجح إنشاء طلب أصلًا.
     */
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
}

/**
 * عنوان العميل من ترويسات الوكيل العكسي.
 *
 * ⚠️ هذه الترويسات يمكن تزويرها إن لم يكن أمام التطبيق وكيل عكسي موثوق
 * يعيد كتابتها. تُستخدم لتحديد المعدّل والتحليلات فقط، ولا يُبنى عليها أي
 * قرار صلاحيات.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * حدود المعدّل لكل نقطة نهاية.
 *
 * القيم الافتراضية هي قيم الإنتاج. تُرفع فقط في بيئة الاختبارات الآلية —
 * حيث تأتي كل الطلبات من 127.0.0.1 فتستنفد الحصة خلال ثوانٍ — عبر متغير
 * البيئة `RATE_LIMIT_MULTIPLIER`. لا يوجد أي طريق لتجاوزها من المتصفح.
 */
function multiplier(): number {
  const raw = Number(process.env.RATE_LIMIT_MULTIPLIER);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(raw, 200);
}

export const LIMITS = {
  /** إنشاء طلب: خمس محاولات كل خمس دقائق */
  order: () => ({ limit: 5 * multiplier(), windowSeconds: 300 }),
  /** تتبّع طلب: عشر محاولات كل خمس دقائق — يمنع تخمين أرقام الهواتف */
  track: () => ({ limit: 10 * multiplier(), windowSeconds: 300 }),
  /** تسعير السلة: سخيّ لأنه يتكرر مع كل تغيير في النموذج */
  quote: () => ({ limit: 60 * multiplier(), windowSeconds: 60 }),
  /**
   * تسجيل دخول المدير: عشر محاولات كل عشر دقائق لكل عنوان.
   * طبقة أولى فقط — `login()` تعدّ المحاولات الفاشلة بالبريد وبالعنوان
   * أيضًا، فحتى لو تجاوز أحدهم هذا الحد لا يستفيد.
   */
  login: () => ({ limit: 10 * multiplier(), windowSeconds: 600 }),
  /** رفع الصور من لوحة التحكم */
  upload: () => ({ limit: 40 * multiplier(), windowSeconds: 300 }),
  /** إضافة تقييم — التحقق من الشراء هو الحارس الأساسي، وهذا حدّ إضافي */
  review: () => ({ limit: 5 * multiplier(), windowSeconds: 600 }),
} as const;

/** تصنيف الجهاز من ترويسة العميل — للإحصائيات */
export function deviceTypeOf(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}
