import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';

/**
 * خريطة الموقع.
 *
 * تُبنى من قاعدة البيانات لا من قائمة ثابتة: أي منتج أو تصنيف يضيفه المدير
 * يظهر فيها تلقائيًا.
 *
 * المستبعَد عمدًا: السلة، المفضلة، إتمام الطلب، صفحات الطلبات، ولوحة
 * التحكم — صفحات شخصية أو بلا محتوى يستحق الفهرسة.
 *
 * في وضع الصيانة نعيد الصفحة الرئيسية وحدها، اتساقًا مع `robots`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

  const settings = await getSettings();

  if (settings.maintenanceMode) {
    return [{ url: base, lastModified: new Date(), priority: 1 }];
  }

  const [products, categories, pages] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.contentPage.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    {
      url: `${base}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/track`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },

    ...products.map((product) => ({
      url: `${base}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),

    ...categories.map((category) => ({
      url: `${base}/category/${encodeURIComponent(category.slug)}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    ...pages.map((page) => ({
      url: `${base}/pages/${encodeURIComponent(page.slug)}`,
      lastModified: page.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ];
}
