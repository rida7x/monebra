import { normalizeArabic, parseCsvField } from '@/lib/utils';

/**
 * بناء نص البحث المُطبّع للمنتج.
 *
 * SQLite لا يعرف أن «أبيض» و«ابيض» نفس الكلمة، ولا يطابق «مسك» بـ«مِسك».
 * لذلك نخزّن نسخة مُطبّعة من كل ما يبحث به العميل في عمود واحد، ونطبّع
 * استعلامه بنفس الدالة قبل المطابقة. النتيجة بحث عربي يعمل فعلًا.
 *
 * يشمل النص: اسم المنتج، العطر العالمي المستوحى منه وأسماءه البديلة،
 * التصنيف، العائلة العطرية، كل النوتات، والكلمات المفتاحية.
 */

export type SearchTextSource = {
  name: string;
  inspirationName?: string | null;
  fragranceFamily?: string | null;
  keywords?: string | null;
  shortDescription?: string | null;
  inspirationBrand?: { name: string; aliases?: string | null } | null;
  category?: { name: string } | null;
  notes?: { name: string }[];
  tags?: { tag: { name: string } }[];
};

export function buildSearchText(product: SearchTextSource): string {
  const parts: string[] = [
    product.name,
    product.inspirationName ?? '',
    product.fragranceFamily ?? '',
    product.shortDescription ?? '',
    product.inspirationBrand?.name ?? '',
    product.category?.name ?? '',
    ...parseCsvField(product.inspirationBrand?.aliases),
    ...parseCsvField(product.keywords),
    ...(product.notes?.map((note) => note.name) ?? []),
    ...(product.tags?.map((entry) => entry.tag.name) ?? []),
  ];

  // مسافة فاصلة بين الأجزاء تمنع التصاق كلمتين وتكوين مطابقة كاذبة
  return normalizeArabic(parts.filter(Boolean).join(' '));
}

/**
 * تقسيم استعلام العميل إلى كلمات مُطبّعة.
 * نتجاهل الكلمات المكونة من حرف واحد لأنها تطابق كل شيء تقريبًا.
 */
export function parseSearchQuery(raw: string): string[] {
  return normalizeArabic(raw)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 6); // حد أقصى — يمنع استعلامات ثقيلة مصطنعة
}

/** أقصى طول مقبول لاستعلام البحث */
export const MAX_QUERY_LENGTH = 80;

export function sanitizeQuery(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.slice(0, MAX_QUERY_LENGTH).trim();
}
