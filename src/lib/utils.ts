import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** دمج أصناف Tailwind مع حل التعارضات */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * يولّد slug صالحًا للروابط من نص عربي أو إنجليزي.
 * العربية تُبقى كما هي (URLs تدعم Unicode) لأن الروابط العربية أفضل للسيو
 * المحلي ولمشاركة الروابط على TikTok.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ـ]/g, '') // حذف التطويل
    .replace(/["'’`.,!?؟،؛:()[\]{}<>|\\/@#$%^&*+=~]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** يضمن تفرّد الـ slug بإضافة لاحقة رقمية */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = slugify(base) || 'item';
  if (!taken.has(slug)) return slug;

  let counter = 2;
  while (taken.has(`${slug}-${counter}`)) counter += 1;
  return `${slug}-${counter}`;
}

/** يحوّل الأرقام العربية-الهندية إلى أرقام لاتينية للمعالجة */
export function normalizeDigits(input: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';

  return input.replace(/[٠-٩۰-۹]/g, (char) => {
    const index = arabicIndic.indexOf(char);
    if (index >= 0) return String(index);
    return String(easternArabic.indexOf(char));
  });
}

/**
 * تطبيع نص عربي للبحث: توحيد الألف والتاء المربوطة والياء، وحذف التشكيل.
 * ضروري حتى يجد العميل «مسك» عند كتابة «مِسك»، و«ابيض» عند كتابة «أبيض».
 */
export function normalizeArabic(input: string): string {
  return normalizeDigits(input)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * تطبيع رقم هاتف ليبي إلى صيغة موحدة.
 * يقبل 0912345678 و+218912345678 و00218912345678 ويعيدها كلها بنفس الشكل.
 * يعيد null إذا كان الرقم غير صالح.
 */
export function normalizePhone(input: string): string | null {
  let digits = normalizeDigits(input).replace(/\D/g, '');

  if (digits.startsWith('00218')) digits = digits.slice(5);
  else if (digits.startsWith('218')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // أرقام الهاتف المحمول الليبية: 9 خانات تبدأ بـ 9
  if (!/^9\d{8}$/.test(digits)) return null;

  return `0${digits}`;
}

/** تنسيق رقم الهاتف للعرض: 091 234 5678 */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
}

/** تنسيق تاريخ بالعربية */
export function formatDate(
  date: Date | string,
  style: 'short' | 'long' | 'datetime' = 'short',
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { dateStyle: 'long' }
      : style === 'datetime'
        ? { dateStyle: 'short', timeStyle: 'short' }
        : { dateStyle: 'short' };

  return new Intl.DateTimeFormat('ar-LY', options).format(value);
}

/** «منذ 5 دقائق» */
export function timeAgo(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - value.getTime()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

  for (const [unit, secondsInUnit] of units) {
    if (seconds >= secondsInUnit) {
      return formatter.format(-Math.floor(seconds / secondsInUnit), unit);
    }
  }

  return 'الآن';
}

/** يقصّ نصًا مع علامة حذف */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/** يحوّل حقل CSV مخزّن كنص إلى مصفوفة نظيفة */
export function parseCsvField(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** تأخير مؤقت — للاستخدام في الاختبارات والتحكم بمعدل الطلبات */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * يفكّ ترميز جزء من المسار قادم من `params`.
 *
 * ⚠️ ضروري لكل مسار ديناميكي: Next يمرّر قيمة `params` **كما وردت في
 * الرابط**، أي مُرمَّزة بالنسبة المئوية. الروابط اللاتينية لا تتأثر لأنها
 * لا تُرمَّز أصلًا، أما العربية فتصل هكذا:
 *
 *   /product/باقة-فاخرة  ←  params.slug = "%D8%A8%D8%A7%D9%82%D8%A9-..."
 *
 * البحث بهذه القيمة في قاعدة البيانات لا يجد شيئًا، فتُرجع الصفحة 404
 * لمنتج موجود فعلًا. هذه الدالة تصحّح ذلك.
 *
 * `try/catch` لأن `decodeURIComponent` يرمي على ترميز فاسد مثل `%zz` —
 * وهو ما قد يصل من رابط مُلفَّق. في تلك الحالة نعيد القيمة كما هي فتفشل
 * المطابقة بهدوء وتظهر صفحة 404 الصحيحة.
 */
export function decodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
