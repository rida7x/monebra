import { cache } from 'react';
import { prisma } from '@/lib/db';

/**
 * إعدادات المتجر.
 *
 * كل قيمة قابلة للتعديل من لوحة التحكم. القيم هنا هي *الافتراضية عند أول
 * تشغيل فقط* — بمجرد حفظ الإعدادات من Dashboard تصبح قاعدة البيانات هي
 * المصدر الوحيد. لا تقرأ أي مكوّن قيمة متجر من الكود مباشرة.
 *
 * الحقول الفارغة مقصودة: لا نضع أرقام هواتف أو روابط وهمية.
 */

export type StoreSettings = {
  // الهوية
  storeName: string;
  storeTagline: string;
  /** شعار الوضع الليلي — النسخة الفاتحة، وهي الافتراضية */
  logoUrl: string;
  /**
   * شعار الوضع النهاري — النسخة الداكنة.
   * فارغًا يُستخدم `logoUrl` في الوضعين: شعار فاتح على ورق عاجي يختفي
   * تقريبًا، فوجود نسخة داكنة ليس ترفًا بل شرط ظهور العلامة أصلًا.
   */
  logoUrlLight: string;
  faviconUrl: string;

  // التواصل
  whatsappNumber: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  addressText: string;
  workingHours: string;

  // التواصل الاجتماعي
  tiktokUrl: string;
  instagramUrl: string;
  facebookUrl: string;

  // العملة
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;

  // السلوك
  freeDeliveryThreshold: number; // بالوحدة الصغرى، 0 = معطّل
  lowStockAlert: boolean;
  allowGuestCheckout: boolean;
  reviewsRequireApproval: boolean;
  ordersEnabled: boolean;
  maintenanceMode: boolean;

  // نصوص
  announcementBar: string;
  inspiredDisclaimer: string;
  footerNote: string;

  /**
   * شريط يظهر أعلى كل صفحة قسم — وعد المتجر عن دقّة المطابقة.
   *
   * ⚠️ في الإعدادات لا في الكود: هذه **دعاية برقم**، وأي رقم معروض يجب أن
   * يبقى بيد صاحب المتجر ليصحّحه أو يزيله متى تغيّر. تركه فارغًا يُخفي
   * الشريط كليًا.
   */
  categoryPromise: string;

  // SEO
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImage: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Monebra Perfume',
  storeTagline: 'عطور مستوحاة من أشهر الروائح العالمية',
  logoUrl: '',
  logoUrlLight: '',
  faviconUrl: '',

  whatsappNumber: '',
  phonePrimary: '',
  phoneSecondary: '',
  email: '',
  addressText: '',
  workingHours: '',

  tiktokUrl: '',
  instagramUrl: '',
  facebookUrl: '',

  currencyCode: 'LYD',
  currencySymbol: 'د.ل',
  currencyDecimals: 2,

  freeDeliveryThreshold: 0,
  lowStockAlert: true,
  allowGuestCheckout: true,
  reviewsRequireApproval: true,
  /**
   * استقبال الطلبات — مفتاح إيقاف فوري بيد المدير.
   *
   * عند إطفائه: صفحة السلة تعرض رسالة صريحة، وصفحة إتمام الطلب تمتنع،
   * و`createOrder` ترفض على الخادم أيضًا — فلا يمكن تجاوزه من الواجهة.
   * يفيد عند نفاد المخزون كله أو الإجازات أو أي توقّف مؤقت.
   */
  ordersEnabled: true,
  maintenanceMode: false,

  announcementBar: '',
  inspiredDisclaimer:
    'جميع عطورنا من إنتاج Monebra Perfume ومستوحاة من روائح عالمية معروفة. ' +
    'أسماء العلامات التجارية المذكورة تعود لأصحابها، ولا نمثّلها ولا ننتسب إليها.',
  footerNote: '',
  categoryPromise: 'في مونيبرا تطابق العطور أعلى من ٩٠٪',

  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  ogImage: '',
};

/** الحقول الحساسة التي يجب ألا تُرسل إلى الواجهة العامة أبدًا */
const PRIVATE_KEYS: readonly (keyof StoreSettings)[] = [];

type SettingKey = keyof StoreSettings;

/**
 * يقرأ الإعدادات من قاعدة البيانات ويدمجها فوق الافتراضية.
 * ملفوف بـ `cache` فيُنفّذ استعلامًا واحدًا لكل طلب مهما تكرر الاستدعاء.
 */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const rows = await prisma.setting.findMany();
    return mergeSettings(rows);
  } catch {
    // قاعدة البيانات غير متاحة — نعيد الافتراضي حتى لا ينهار الموقع كله
    return { ...DEFAULT_SETTINGS };
  }
});

/** نسخة عامة آمنة للإرسال إلى المتصفح */
export async function getPublicSettings(): Promise<StoreSettings> {
  const settings = await getSettings();
  const safe = { ...settings };
  for (const key of PRIVATE_KEYS) {
    delete safe[key];
  }
  return safe;
}

function mergeSettings(rows: { key: string; value: string }[]): StoreSettings {
  const result: StoreSettings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;

    const key = row.key as SettingKey;
    const parsed = safeParse(row.value);
    if (parsed === undefined) continue;

    // نحترم نوع القيمة الافتراضية — يمنع إفساد الواجهة بقيمة من نوع خاطئ
    const expected = typeof DEFAULT_SETTINGS[key];
    if (typeof parsed !== expected) continue;

    // @ts-expect-error — تم التحقق من النوع أعلاه في وقت التشغيل
    result[key] = parsed;
  }

  return result;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** يحفظ مجموعة إعدادات — يُستدعى من لوحة التحكم فقط */
export async function saveSettings(
  patch: Partial<StoreSettings>,
): Promise<void> {
  const entries = Object.entries(patch).filter(
    ([key]) => key in DEFAULT_SETTINGS,
  );

  if (entries.length === 0) return;

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value), group: groupOf(key) },
        update: { value: JSON.stringify(value) },
      }),
    ),
  );
}

function groupOf(key: string): string {
  if (key.startsWith('currency')) return 'currency';
  if (key.startsWith('meta') || key === 'ogImage') return 'seo';
  if (
    key.endsWith('Url') &&
    ['tiktokUrl', 'instagramUrl', 'facebookUrl'].includes(key)
  ) {
    return 'social';
  }
  if (
    ['whatsappNumber', 'phonePrimary', 'phoneSecondary', 'email', 'addressText', 'workingHours'].includes(
      key,
    )
  ) {
    return 'contact';
  }
  return 'general';
}

/** يبني رابط واتساب برسالة مُعدّة مسبقًا */
export function whatsappLink(number: string, message?: string): string | null {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 8) return null;

  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
