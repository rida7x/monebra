import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  getProductFormOptions,
  getBundleCandidates,
} from '@/lib/services/admin-products';
import { ProductForm } from '@/components/admin/ProductForm';

export const metadata: Metadata = {
  title: 'منتج جديد',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
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
    />
  );
}
