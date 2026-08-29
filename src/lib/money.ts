/**
 * التعامل مع المبالغ المالية.
 *
 * قاعدة صارمة: كل المبالغ في قاعدة البيانات وفي منطق الأعمال محفوظة كأعداد
 * صحيحة (Int) بالوحدة الصغرى — أي المبلغ × 1000. السبب أن الدينار الليبي
 * عملة من ثلاث خانات عشرية (ISO 4217 minor unit = 3)، وأن الأعداد العشرية
 * العائمة (float) تُنتج أخطاء تقريب غير مقبولة في الفواتير.
 *
 * لا تستخدم أبدًا `number` عشري لتمثيل مبلغ. حوّل عند الإدخال والعرض فقط.
 */

/** عدد الوحدات الصغرى في وحدة العملة الواحدة */
export const MONEY_SCALE = 1000;

/** أقصى مبلغ يمكن تمثيله بأمان (حد Int في SQLite/Postgres) */
export const MAX_MONEY = 2_000_000_000;

/**
 * يحوّل مبلغًا معروضًا (45.5) إلى الوحدة الصغرى (45500).
 * يستخدم للإدخال من لوحة التحكم فقط — لا يُستدعى ببيانات من العميل.
 */
export function toMinor(amount: number | string): number {
  const value = typeof amount === 'string' ? Number(amount.trim()) : amount;

  if (!Number.isFinite(value)) {
    throw new RangeError(`مبلغ غير صالح: ${amount}`);
  }

  const minor = Math.round(value * MONEY_SCALE);

  if (Math.abs(minor) > MAX_MONEY) {
    throw new RangeError(`المبلغ خارج النطاق المسموح: ${amount}`);
  }

  return minor;
}

/** يحوّل من الوحدة الصغرى (45500) إلى الرقم المعروض (45.5) */
export function toMajor(minor: number): number {
  return minor / MONEY_SCALE;
}

/**
 * تنسيق مبلغ للعرض بالعربية.
 * `decimals` تأتي من إعدادات المتجر — لا تُثبّت في الكود.
 */
export function formatMoney(
  minor: number,
  options: { currency?: string; decimals?: number; withCurrency?: boolean } = {},
): string {
  const { currency = 'د.ل', decimals = 2, withCurrency = true } = options;

  const formatted = new Intl.NumberFormat('ar-LY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(toMajor(minor));

  return withCurrency ? `${formatted} ${currency}` : formatted;
}

/** نسبة الخصم بين سعرين، مقرّبة لأقرب عدد صحيح. صفر إذا لا يوجد خصم. */
export function discountPercent(price: number, comparePrice?: number | null): number {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

/**
 * يطبّق نسبة مئوية على مبلغ ويعيد قيمة الخصم (لا المبلغ بعد الخصم).
 * التقريب لأسفل حتى لا يتجاوز الخصم النسبة المعلنة.
 */
export function percentOf(minor: number, percent: number): number {
  return Math.floor((minor * percent) / 100);
}

/** يحصر مبلغًا بين حدين */
export function clampMoney(minor: number, min: number, max: number): number {
  return Math.min(Math.max(minor, min), max);
}
