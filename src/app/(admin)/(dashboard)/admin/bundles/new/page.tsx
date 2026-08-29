import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  getProductFormOptions,
  getBundleCandidates,
} from '@/lib/services/admin-products';
import { ProductForm } from '@/components/admin/ProductForm';

export const metadata: Metadata = {
  title: 'باقة جديدة',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * إنشاء باقة.
 *
 * نفس نموذج المنتج بـ `defaultType="bundle"` — الباقة منتج من نوع خاص لا
 * كيان منفصل، فترث الصور والسيو والسلة والتقييمات كلها بلا تكرار كود.
 */
export default async function NewBundlePage() {
  await requirePageAccess('products.manage');

  const [{ categories, brands }, settings, bundleVariants] = await Promise.all([
    getProductFormOptions(),
    getSettings(),
    getBundleCandidates(),
  ]);

  return (
    <ProductForm
      product={null}
      categories={categories}
      brands={brands}
      currencySymbol={settings.currencySymbol}
      currencyDecimals={settings.currencyDecimals}
      bundleVariants={bundleVariants}
      defaultType="bundle"
    />
  );
}
