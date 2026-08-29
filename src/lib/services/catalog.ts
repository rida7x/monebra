import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { discountPercent } from '@/lib/money';
import { stockLevelOf, type StockLevel } from '@/lib/constants';

/**
 * طبقة الخدمة للكتالوج.
 *
 * كل قراءة للمنتجات تمر من هنا، فلا يكرر أي مكوّن استعلامًا ولا يصل إلى
 * Prisma مباشرة. هذا يضمن أن قواعد العرض — لا نُظهر إلا المنتجات المفعّلة،
 * ولا نحسب السعر إلا من الأحجام المفعّلة — تُطبّق في مكان واحد.
 */

/** شكل المنتج كما تحتاجه بطاقة المنتج — خفيف ومحسوب مسبقًا */
export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  gender: string;
  inspirationName: string | null;
  inspirationBrand: string | null;
  categoryName: string | null;
  image: string | null;
  imageAlt: string | null;

  /** أقل سعر بين الأحجام المتاحة، بالوحدة الصغرى */
  price: number;
  comparePrice: number | null;
  discountPercent: number;

  /** عدد الأحجام المتاحة — تُعرض «من» قبل السعر عند تعددها */
  variantCount: number;
  sizeLabel: string | null;

  /** أرخص حجم متاح — يتيح «إضافة للسلة» مباشرة من البطاقة عند وجود حجم واحد */
  defaultVariantId: string | null;
  defaultVariantInStock: boolean;

  totalStock: number;
  stockLevel: StockLevel;

  isNew: boolean;
  isBestSeller: boolean;
  isLimited: boolean;
  isFeatured: boolean;
};

/** الحقول اللازمة لبناء بطاقة منتج — نطلبها فقط لتقليل حجم الاستعلام */
export const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  gender: true,
  inspirationName: true,
  isNew: true,
  isBestSeller: true,
  isLimited: true,
  isFeatured: true,
  inspirationBrand: { select: { name: true } },
  category: { select: { name: true } },
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    take: 1,
    select: { url: true, alt: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      label: true,
      price: true,
      comparePrice: true,
      stock: true,
      lowStockThreshold: true,
    },
  },
} satisfies Prisma.ProductSelect;

/** مشتق من الاستعلام نفسه — يستحيل أن ينحرف عنه */
export type RawCardProduct = Prisma.ProductGetPayload<{
  select: typeof CARD_SELECT;
}>;

export function toCardData(product: RawCardProduct): ProductCardData {
  const variants = product.variants;
  const cheapest = variants[0];

  const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);

  // عتبة المخزون المنخفض للمنتج = عتبة أعلى حجم، حتى لا يُعلن «منخفض»
  // لمجرد نفاد حجم واحد بينما البقية متوفرة بكثرة
  const threshold = variants.reduce(
    (max, variant) => Math.max(max, variant.lowStockThreshold),
    0,
  );

  const price = cheapest?.price ?? 0;
  const comparePrice = cheapest?.comparePrice ?? null;
  const image = product.images[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    gender: product.gender,
    inspirationName: product.inspirationName,
    inspirationBrand: product.inspirationBrand?.name ?? null,
    categoryName: product.category?.name ?? null,
    image: image?.url ?? null,
    imageAlt: image?.alt ?? null,

    price,
    comparePrice,
    discountPercent: discountPercent(price, comparePrice),

    variantCount: variants.length,
    sizeLabel: cheapest?.label ?? null,
    defaultVariantId: cheapest?.id ?? null,
    defaultVariantInStock: (cheapest?.stock ?? 0) > 0,

    totalStock,
    stockLevel: stockLevelOf(totalStock, threshold),

    isNew: product.isNew,
    isBestSeller: product.isBestSeller,
    isLimited: product.isLimited,
    isFeatured: product.isFeatured,
  };
}

/** منتجات الواجهة الرئيسية — المختارة أولًا ثم الأحدث */
export const getFeaturedProducts = cache(
  async (limit = 8): Promise<ProductCardData[]> => {
    const products = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: CARD_SELECT,
    });

    return products.map(toCardData);
  },
);

export const getBestSellers = cache(
  async (limit = 8): Promise<ProductCardData[]> => {
    const products = await prisma.product.findMany({
      where: { isActive: true, isBestSeller: true },
      orderBy: [{ salesCount: 'desc' }, { sortOrder: 'asc' }],
      take: limit,
      select: CARD_SELECT,
    });

    return products.map(toCardData);
  },
);

export const getNewArrivals = cache(
  async (limit = 8): Promise<ProductCardData[]> => {
    const products = await prisma.product.findMany({
      where: { isActive: true, isNew: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: CARD_SELECT,
    });

    return products.map(toCardData);
  },
);

/** التصنيفات المفعّلة مع عدد المنتجات في كل منها */
export const getActiveCategories = cache(async () => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      description: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    description: category.description,
    productCount: category._count.products,
  }));
});

/** شرائح الواجهة الرئيسية — يديرها المدير من لوحة التحكم */
export const getHeroSlides = cache(async () => {
  return prisma.heroSlide.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
});
