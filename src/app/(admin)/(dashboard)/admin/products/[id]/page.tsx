import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  getAdminProduct,
  getProductFormOptions,
  getBundleCandidates,
} from '@/lib/services/admin-products';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

const loadProduct = cache(async (id: string) => getAdminProduct(id));

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) notFound();

  return {
    title: `تعديل ${product.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function EditProductPage({ params }: PageProps) {
  await requirePageAccess('products.manage');

  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) notFound();

  const [{ categories, brands }, settings, bundleVariants] = await Promise.all([
    getProductFormOptions(),
    getSettings(),
    getBundleCandidates(),
  ]);

  return (
    <ProductForm
      product={product}
      categories={categories}
      brands={brands}
      currencySymbol={settings.currencySymbol}
      currencyDecimals={settings.currencyDecimals}
      bundleVariants={bundleVariants}
    />
  );
}
