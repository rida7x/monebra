import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { discountPercent } from '@/lib/money';
import { stockLevelOf, type StockLevel } from '@/lib/constants';
import { toCardData, CARD_SELECT, type ProductCardData } from '@/lib/services/catalog';
import { parseCsvField } from '@/lib/utils';

/**
 * تفاصيل المنتج.
 *
 * منفصلة عن استعلام البطاقات لأنها تجلب حقولًا أثقل (الوصف، كل الصور، كل
 * النوتات). لو دمجناهما لدفعنا ثمن هذه الحقول في كل شبكة منتجات.
 */

export type VariantData = {
  id: string;
  label: string;
  sizeMl: number | null;
  price: number;
  comparePrice: number | null;
  discountPercent: number;
  stock: number;
  stockLevel: StockLevel;
  inStock: boolean;
};

export type ProductDetail = {
  id: string;
  type: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;

  gender: string;
  fragranceFamily: string | null;
  longevity: number;
  sillage: number;
  seasons: string[];
  occasions: string[];
  timeOfDay: string | null;

  inspirationName: string | null;
  inspirationBrand: string | null;

  category: { name: string; slug: string } | null;

  images: { url: string; alt: string | null }[];
  variants: VariantData[];
  notes: { top: string[]; middle: string[]; base: string[] };
  tags: string[];

  /** أصناف الباقة — فارغة للمنتجات العادية */
  bundleItems: { name: string; slug: string; label: string; quantity: number }[];

  isNew: boolean;
  isBestSeller: boolean;
  isLimited: boolean;

  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;

  /** التقييمات المعتمدة فقط */
  ratingAverage: number | null;
  ratingCount: number;
};

export const getProductBySlug = cache(
  async (slug: string): Promise<ProductDetail | null> => {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        gender: true,
        fragranceFamily: true,
        longevity: true,
        sillage: true,
        season: true,
        occasion: true,
        timeOfDay: true,
        inspirationName: true,
        isNew: true,
        isBestSeller: true,
        isLimited: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        inspirationBrand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: { url: true, alt: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            sizeMl: true,
            price: true,
            comparePrice: true,
            stock: true,
            lowStockThreshold: true,
          },
        },
        notes: {
          orderBy: { sortOrder: 'asc' },
          select: { type: true, name: true },
        },
        tags: { select: { tag: { select: { name: true } } } },
        bundleItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            quantity: true,
            itemVariant: {
              select: {
                label: true,
                product: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    if (!product) return null;

    const reviews = await prisma.review.aggregate({
      where: { productId: product.id, status: 'approved' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      id: product.id,
      type: product.type,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,

      gender: product.gender,
      fragranceFamily: product.fragranceFamily,
      longevity: product.longevity,
      sillage: product.sillage,
      seasons: parseCsvField(product.season),
      occasions: parseCsvField(product.occasion),
      timeOfDay: product.timeOfDay,

      inspirationName: product.inspirationName,
      inspirationBrand: product.inspirationBrand?.name ?? null,

      category: product.category,

      images: product.images,

      variants: product.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        sizeMl: variant.sizeMl,
        price: variant.price,
        comparePrice: variant.comparePrice,
        discountPercent: discountPercent(variant.price, variant.comparePrice),
        stock: variant.stock,
        stockLevel: stockLevelOf(variant.stock, variant.lowStockThreshold),
        inStock: variant.stock > 0,
      })),

      notes: {
        top: product.notes.filter((n) => n.type === 'top').map((n) => n.name),
        middle: product.notes
          .filter((n) => n.type === 'middle')
          .map((n) => n.name),
        base: product.notes.filter((n) => n.type === 'base').map((n) => n.name),
      },

      tags: product.tags.map((entry) => entry.tag.name),

      bundleItems: product.bundleItems.map((item) => ({
        name: item.itemVariant.product.name,
        slug: item.itemVariant.product.slug,
        label: item.itemVariant.label,
        quantity: item.quantity,
      })),

      isNew: product.isNew,
      isBestSeller: product.isBestSeller,
      isLimited: product.isLimited,

      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      ogImage: product.ogImage,

      ratingAverage: reviews._avg.rating,
      ratingCount: reviews._count.rating,
    };
  },
);

/**
 * منتجات ذات صلة: نفس التصنيف أولًا، ثم نفس الجنس، ثم الأكثر مبيعًا.
 * نستبعد المنتج نفسه دائمًا، ونكمل النقص من المستوى التالي حتى لا يظهر
 * قسم شبه فارغ.
 */
export const getRelatedProducts = cache(
  async (
    productId: string,
    categoryId: string | null,
    gender: string,
    limit = 4,
  ): Promise<ProductCardData[]> => {
    const collected = new Map<string, ProductCardData>();

    // ثلاثة مستويات قرب، من الأدق إلى الأعم
    const levels: Prisma.ProductWhereInput[] = [
      ...(categoryId
        ? [{ isActive: true, id: { not: productId }, categoryId }]
        : []),
      { isActive: true, id: { not: productId }, gender },
      { isActive: true, id: { not: productId } },
    ];

    for (const where of levels) {
      if (collected.size >= limit) break;

      const rows = await prisma.product.findMany({
        where,
        orderBy: [{ isBestSeller: 'desc' }, { salesCount: 'desc' }],
        take: limit * 2,
        select: CARD_SELECT,
      });

      for (const row of rows) {
        if (collected.size >= limit) break;
        if (collected.has(row.id)) continue;
        collected.set(row.id, toCardData(row));
      }
    }

    return [...collected.values()].slice(0, limit);
  },
);

/** تُستدعى من صفحة المنتج لتغذية إحصائيات لوحة التحكم */
export async function recordProductView(productId: string): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.analyticsEvent.create({
        data: { type: 'product_view', productId },
      }),
    ]);
  } catch {
    // إحصائية فقط — لا يجوز أن تمنع عرض صفحة المنتج
  }
}

/**
 * التقييمات المعتمدة لمنتج.
 *
 * لا نعيد رقم الهاتف أبدًا — يُستخدم للتحقق من الشراء ومنع التكرار فقط،
 * وإرساله للمتصفح تسريب لبيانات العميل.
 */
export const getApprovedReviews = cache(async (productId: string) => {
  return prisma.review.findMany({
    where: { productId, status: 'approved' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      customerName: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });
});
