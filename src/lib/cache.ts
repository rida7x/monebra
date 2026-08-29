import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * إبطال الذاكرة المؤقتة.
 *
 * صفحات المتجر تُبنى مسبقًا (ISR) لتكون سريعة على الشبكات الضعيفة. عندما
 * يعدّل المدير منتجًا أو سعرًا أو مدينة، يجب أن ينعكس التغيير فورًا.
 *
 * كل عملية كتابة في لوحة التحكم تستدعي الدالة المناسبة من هنا — فيبقى
 * منطق الإبطال في مكان واحد، ولا ينسى أحد إبطال صفحة.
 */

export const CACHE_TAGS = {
  products: 'products',
  product: (slug: string) => `product:${slug}`,
  categories: 'categories',
  cities: 'cities',
  settings: 'settings',
  hero: 'hero',
  coupons: 'coupons',
  reviews: 'reviews',
  reviewsOf: (productId: string) => `reviews:${productId}`,
} as const;

/** مدة صلاحية الصفحات المبنية مسبقًا بالثواني (تُستخدم كـ `revalidate`) */
export const REVALIDATE = {
  /** الصفحات التي تتغير مع كل تعديل للمخزون */
  catalog: 120,
  /** صفحات المحتوى والسياسات — نادرة التغيير */
  content: 3600,
} as const;

/** بعد أي تعديل على منتج */
export function invalidateProduct(slug?: string): void {
  revalidateTag(CACHE_TAGS.products, 'max');
  if (slug) revalidateTag(CACHE_TAGS.product(slug), 'max');

  revalidatePath('/');
  revalidatePath('/products');
  if (slug) revalidatePath(`/product/${slug}`);
}

/** بعد أي تعديل على التصنيفات */
export function invalidateCategories(): void {
  revalidateTag(CACHE_TAGS.categories, 'max');
  revalidatePath('/', 'layout');
}

/** بعد أي تعديل على المدن أو أسعار التوصيل */
export function invalidateCities(): void {
  revalidateTag(CACHE_TAGS.cities, 'max');
  revalidatePath('/checkout');
}

/** بعد أي تعديل على الإعدادات — يمس كل صفحة */
export function invalidateSettings(): void {
  revalidateTag(CACHE_TAGS.settings, 'max');
  revalidatePath('/', 'layout');
}

/** بعد تعديل شرائح الواجهة الرئيسية */
export function invalidateHero(): void {
  revalidateTag(CACHE_TAGS.hero, 'max');
  revalidatePath('/');
}

/** بعد الموافقة على تقييم أو إخفائه */
export function invalidateReviews(productSlug?: string, productId?: string): void {
  revalidateTag(CACHE_TAGS.reviews, 'max');
  if (productId) revalidateTag(CACHE_TAGS.reviewsOf(productId), 'max');
  if (productSlug) revalidatePath(`/product/${productSlug}`);
}

/**
 * بعد تغيير المخزون — لا يستدعي إبطالًا واسعًا لأن المخزون يُتحقق منه
 * على الخادم عند كل طلب. الإبطال هنا لتحديث شارات «غير متوفر» المعروضة.
 */
export function invalidateStock(slug?: string): void {
  invalidateProduct(slug);
}
