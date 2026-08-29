import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { toCardData, CARD_SELECT, type ProductCardData } from '@/lib/services/catalog';
import { parseSearchQuery } from '@/lib/search';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  GENDERS,
  SEASONS,
  OCCASIONS,
  PRODUCT_SORTS,
  type Gender,
  type Season,
  type Occasion,
  type ProductSort,
} from '@/lib/constants';

/**
 * استعلام المنتجات مع الفلاتر والترتيب والصفحات.
 *
 * كل المدخلات تأتي من الـ URL أي من المستخدم، فتُنظَّف هنا قبل أن تلمس
 * قاعدة البيانات: القيم غير المعروفة تُهمَل، والأرقام تُحصر في نطاق آمن،
 * وحجم الصفحة له سقف. لا يمكن لأحد أن يطلب 100000 منتج أو يمرر قيمة غريبة.
 */

export type ProductFilters = {
  q?: string;
  categorySlug?: string;
  genders?: Gender[];
  seasons?: Season[];
  occasions?: Occasion[];
  families?: string[];
  notes?: string[];
  /** بالوحدة الصغرى */
  minPrice?: number;
  maxPrice?: number;
  sizes?: number[];
  minLongevity?: number;
  minSillage?: number;
  onlyOffers?: boolean;
  onlyNew?: boolean;
  onlyBestSellers?: boolean;
  onlyInStock?: boolean;
  onlyBundles?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type ProductQueryResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** يحوّل معاملات الـ URL إلى فلاتر مُتحقَّق منها */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ProductFilters {
  const one = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const many = (key: string): string[] => {
    const value = params[key];
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12);
  };

  const money = (key: string): number | undefined => {
    const raw = one(key);
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.round(value * 1000);
  };

  const int = (key: string, min: number, max: number): number | undefined => {
    const raw = one(key);
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value)) return undefined;
    return Math.min(Math.max(value, min), max);
  };

  const flag = (key: string): boolean | undefined =>
    one(key) === '1' ? true : undefined;

  const sortRaw = one('sort');
  const sort = PRODUCT_SORTS.includes(sortRaw as ProductSort)
    ? (sortRaw as ProductSort)
    : undefined;

  const sizes = many('size')
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 1000);

  return {
    q: one('q'),
    categorySlug: one('category'),
    genders: many('gender').filter((value): value is Gender =>
      GENDERS.includes(value as Gender),
    ),
    seasons: many('season').filter((value): value is Season =>
      SEASONS.includes(value as Season),
    ),
    occasions: many('occasion').filter((value): value is Occasion =>
      OCCASIONS.includes(value as Occasion),
    ),
    families: many('family'),
    notes: many('note'),
    minPrice: money('min'),
    maxPrice: money('max'),
    sizes,
    minLongevity: int('longevity', 1, 5),
    minSillage: int('sillage', 1, 5),
    onlyOffers: flag('offers'),
    onlyNew: flag('new'),
    onlyBestSellers: flag('best'),
    onlyInStock: flag('instock'),
    onlyBundles: flag('bundles'),
    sort,
    page: int('page', 1, 500) ?? 1,
    pageSize: int('per', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
  };
}

function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

  // ── البحث النصي ──
  // كل كلمة يجب أن تظهر في نص البحث المُطبّع (AND وليس OR)، فتضييق
  // الاستعلام بكلمة إضافية يُقلل النتائج كما يتوقع المستخدم
  if (filters.q) {
    for (const word of parseSearchQuery(filters.q)) {
      and.push({ searchText: { contains: word } });
    }
  }

  if (filters.categorySlug) {
    and.push({ category: { slug: filters.categorySlug } });
  }

  if (filters.genders?.length) {
    and.push({ gender: { in: filters.genders } });
  }

  // الموسم والمناسبة مخزّنان كنص مفصول بفواصل — نطابق بالاحتواء
  if (filters.seasons?.length) {
    and.push({
      OR: filters.seasons.map((season) => ({
        season: { contains: season },
      })),
    });
  }

  if (filters.occasions?.length) {
    and.push({
      OR: filters.occasions.map((occasion) => ({
        occasion: { contains: occasion },
      })),
    });
  }

  if (filters.families?.length) {
    and.push({ fragranceFamily: { in: filters.families } });
  }

  if (filters.notes?.length) {
    and.push({
      notes: { some: { name: { in: filters.notes } } },
    });
  }

  if (filters.minLongevity) {
    and.push({ longevity: { gte: filters.minLongevity } });
  }

  if (filters.minSillage) {
    and.push({ sillage: { gte: filters.minSillage } });
  }

  if (filters.onlyNew) and.push({ isNew: true });
  if (filters.onlyBestSellers) and.push({ isBestSeller: true });
  if (filters.onlyBundles) and.push({ type: 'bundle' });

  // ── فلاتر على مستوى الحجم ──
  // كل شرط في `some` منفصل: يكفي وجود *حجم واحد* يحقق كل الشروط معًا
  const variantConditions: Prisma.ProductVariantWhereInput = { isActive: true };

  if (filters.minPrice !== undefined) {
    variantConditions.price = { gte: filters.minPrice };
  }
  if (filters.maxPrice !== undefined) {
    variantConditions.price = {
      ...(variantConditions.price as object),
      lte: filters.maxPrice,
    };
  }
  if (filters.sizes?.length) {
    variantConditions.sizeMl = { in: filters.sizes };
  }
  if (filters.onlyInStock) {
    variantConditions.stock = { gt: 0 };
  }
  if (filters.onlyOffers) {
    variantConditions.comparePrice = { not: null };
  }

  and.push({ variants: { some: variantConditions } });

  return { AND: and };
}

function buildOrderBy(
  sort: ProductSort | undefined,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'best_selling':
      return [{ salesCount: 'desc' }, { viewCount: 'desc' }];
    case 'price_asc':
      return [{ minPrice: 'asc' }, { sortOrder: 'asc' }];
    case 'price_desc':
      return [{ minPrice: 'desc' }, { sortOrder: 'asc' }];
    case 'featured':
    default:
      return [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }];
  }
}

export async function queryProducts(
  filters: ProductFilters,
): Promise<ProductQueryResult> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const where = buildWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: CARD_SELECT,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(toCardData),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** بحث سريع للقائمة المنسدلة — نتائج قليلة وحقول أقل */
export async function quickSearch(
  query: string,
  limit = 6,
): Promise<ProductCardData[]> {
  const words = parseSearchQuery(query);
  if (words.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      AND: words.map((word) => ({ searchText: { contains: word } })),
    },
    orderBy: [{ isBestSeller: 'desc' }, { salesCount: 'desc' }],
    take: limit,
    select: CARD_SELECT,
  });

  return rows.map(toCardData);
}

/**
 * اقتراحات عند غياب النتائج — الأكثر مبيعًا من نفس التصنيف إن أمكن،
 * وإلا الأكثر مبيعًا عمومًا. حتى لا تكون صفحة «لم نجد» طريقًا مسدودًا.
 */
export async function getSuggestions(limit = 4): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ isBestSeller: 'desc' }, { salesCount: 'desc' }, { viewCount: 'desc' }],
    take: limit,
    select: CARD_SELECT,
  });

  return rows.map(toCardData);
}

/**
 * القيم المتاحة للفلاتر — تُبنى من المنتجات الموجودة فعلًا، فلا يظهر للعميل
 * فلتر لا يعطي أي نتيجة.
 */
export async function getFilterOptions() {
  const [families, sizes, notes, priceRange] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, fragranceFamily: { not: null } },
      distinct: ['fragranceFamily'],
      select: { fragranceFamily: true },
      orderBy: { fragranceFamily: 'asc' },
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, sizeMl: { not: null } },
      distinct: ['sizeMl'],
      select: { sizeMl: true },
      orderBy: { sizeMl: 'asc' },
    }),
    prisma.productNote.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 24,
    }),
    prisma.productVariant.aggregate({
      where: { isActive: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    families: families
      .map((row) => row.fragranceFamily)
      .filter((value): value is string => Boolean(value)),
    sizes: sizes
      .map((row) => row.sizeMl)
      .filter((value): value is number => value !== null),
    notes: notes.map((row) => ({ name: row.name, count: row._count.name })),
    minPrice: priceRange._min.price ?? 0,
    maxPrice: priceRange._max.price ?? 0,
  };
}
