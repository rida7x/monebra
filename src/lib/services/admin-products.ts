import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { buildSearchText } from '@/lib/search';
import { slugify } from '@/lib/utils';
import { removeImage } from '@/lib/storage';

/**
 * إنشاء المنتجات وتعديلها.
 *
 * ثلاث قواعد تحكم هذا الملف:
 *
 *  1. **الأسعار تصل بالوحدة الصغرى**. طبقة الـ API هي التي تحوّل ما يكتبه
 *     المدير (45.5) إلى عدد صحيح (45500). هنا نتعامل بالأعداد الصحيحة فقط.
 *
 *  2. **لا نحذف الأحجام التي بيعت**. حذف `product_variants` يجعل
 *     `order_items.variantId` فارغًا؛ الفاتورة تبقى صحيحة بفضل النسخة
 *     المحفوظة، لكن سجل المخزون ينكسر. لذلك: الحجم الذي له طلبات
 *     يُعطَّل (`isActive = false`) ولا يُحذف.
 *
 *  3. **نص البحث يُعاد بناؤه في كل حفظ**. لو نسيناه لأصبح المنتج غير قابل
 *     للعثور عليه باسمه الجديد.
 */

export type VariantInput = {
  id?: string;
  label: string;
  sizeMl?: number | null;
  price: number;
  comparePrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
};

export type BundleItemInput = {
  variantId: string;
  quantity: number;
};

export type ProductInput = {
  /** simple = عطر مفرد، bundle = باقة تضم عدة أحجام */
  type?: 'simple' | 'bundle';
  /** أصناف الباقة — تُتجاهل للمنتج المفرد */
  bundleItems?: BundleItemInput[];
  name: string;
  slug?: string;
  shortDescription?: string | null;
  description?: string | null;
  categoryId?: string | null;
  inspirationBrandId?: string | null;
  inspirationName?: string | null;
  gender: string;
  fragranceFamily?: string | null;
  longevity: number;
  sillage: number;
  seasons: string[];
  occasions: string[];
  timeOfDay?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isLimited: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  keywords?: string | null;
  images: string[];
  notes: { type: string; name: string }[];
  variants: VariantInput[];
};

export type SaveProductResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/** يضمن تفرّد الـ slug مع تجاهل المنتج نفسه عند التعديل */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'product';
  let candidate = root;
  let counter = 2;

  for (;;) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;

    candidate = `${root}-${counter}`;
    counter += 1;
  }
}

export async function createProduct(
  input: ProductInput,
): Promise<SaveProductResult> {
  if (input.variants.length === 0) {
    return { ok: false, error: 'أضف حجمًا واحدًا على الأقل بسعره' };
  }

  const slug = await uniqueSlug(input.slug || input.name);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        ...baseFields(input),
        slug,
        type: input.type ?? 'simple',
        bundleItems:
          input.type === 'bundle' && input.bundleItems?.length
            ? {
                create: input.bundleItems.map((item, index) => ({
                  itemVariantId: item.variantId,
                  quantity: item.quantity,
                  sortOrder: index,
                })),
              }
            : undefined,
        images: {
          create: input.images.map((url, index) => ({
            url,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },
        notes: {
          create: input.notes.map((note, index) => ({
            type: note.type,
            name: note.name,
            sortOrder: index,
          })),
        },
        variants: {
          create: input.variants.map((variant, index) => ({
            label: variant.label,
            sizeMl: variant.sizeMl ?? null,
            price: variant.price,
            comparePrice: variant.comparePrice ?? null,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            isActive: variant.isActive,
            sortOrder: index,
          })),
        },
      },
      select: { id: true, slug: true },
    });

    await refreshSearchText(tx, created.id);
    await refreshMinPrice(tx, created.id);

    // مخزون افتتاحي: نسجّله كحركة حتى يبدأ سجل التدقيق من نقطة معلومة
    for (const variant of await tx.productVariant.findMany({
      where: { productId: created.id },
      select: { id: true, stock: true },
    })) {
      if (variant.stock === 0) continue;

      await tx.inventoryMovement.create({
        data: {
          variantId: variant.id,
          delta: variant.stock,
          reason: 'restock',
          stockAfter: variant.stock,
          note: 'مخزون افتتاحي عند إنشاء المنتج',
        },
      });
    }

    return created;
  });

  return { ok: true, id: product.id, slug: product.slug };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<SaveProductResult> {
  if (input.variants.length === 0) {
    return { ok: false, error: 'أضف حجمًا واحدًا على الأقل بسعره' };
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      images: { select: { url: true } },
      variants: {
        select: { id: true, stock: true, _count: { select: { orderItems: true } } },
      },
    },
  });

  if (!existing) return { ok: false, error: 'المنتج غير موجود' };

  const slug = await uniqueSlug(input.slug || input.name, id);

  const keptVariantIds = new Set(
    input.variants.map((variant) => variant.id).filter(Boolean) as string[],
  );

  const removedImages = existing.images
    .map((image) => image.url)
    .filter((url) => !input.images.includes(url));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: { ...baseFields(input), slug, type: input.type ?? 'simple' },
    });

    // أصناف الباقة: استبدال كامل — لا مراجع خارجية عليها
    await tx.bundleItem.deleteMany({ where: { bundleId: id } });

    if (input.type === 'bundle' && input.bundleItems?.length) {
      await tx.bundleItem.createMany({
        data: input.bundleItems.map((item, index) => ({
          bundleId: id,
          itemVariantId: item.variantId,
          quantity: item.quantity,
          sortOrder: index,
        })),
      });
    }

    // ── الصور والنوتات: استبدال كامل، فهي بلا مراجع خارجية ──
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productImage.createMany({
      data: input.images.map((url, index) => ({
        productId: id,
        url,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });

    await tx.productNote.deleteMany({ where: { productId: id } });
    await tx.productNote.createMany({
      data: input.notes.map((note, index) => ({
        productId: id,
        type: note.type,
        name: note.name,
        sortOrder: index,
      })),
    });

    // ── الأحجام: تحديث أو إنشاء ──
    for (const [index, variant] of input.variants.entries()) {
      const previous = variant.id
        ? existing.variants.find((row) => row.id === variant.id)
        : undefined;

      if (previous) {
        await tx.productVariant.update({
          where: { id: previous.id },
          data: {
            label: variant.label,
            sizeMl: variant.sizeMl ?? null,
            price: variant.price,
            comparePrice: variant.comparePrice ?? null,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            isActive: variant.isActive,
            sortOrder: index,
          },
        });

        // تعديل المخزون يدويًا يُسجَّل كحركة تدقيق باسم «تعديل»
        if (previous.stock !== variant.stock) {
          await tx.inventoryMovement.create({
            data: {
              variantId: previous.id,
              delta: variant.stock - previous.stock,
              reason: 'adjustment',
              stockAfter: variant.stock,
              note: 'تعديل من صفحة المنتج',
            },
          });
        }
      } else {
        const created = await tx.productVariant.create({
          data: {
            productId: id,
            label: variant.label,
            sizeMl: variant.sizeMl ?? null,
            price: variant.price,
            comparePrice: variant.comparePrice ?? null,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            isActive: variant.isActive,
            sortOrder: index,
          },
          select: { id: true, stock: true },
        });

        if (created.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: created.id,
              delta: created.stock,
              reason: 'restock',
              stockAfter: created.stock,
              note: 'حجم جديد أُضيف للمنتج',
            },
          });
        }
      }
    }

    // ── الأحجام المحذوفة من النموذج ──
    for (const variant of existing.variants) {
      if (keptVariantIds.has(variant.id)) continue;

      if (variant._count.orderItems > 0) {
        // بيع من قبل ⇒ نعطّله ولا نحذفه، حفاظًا على سجل المخزون
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { isActive: false },
        });
      } else {
        await tx.productVariant.delete({ where: { id: variant.id } });
      }
    }

    await refreshSearchText(tx, id);
    await refreshMinPrice(tx, id);
  });

  // حذف ملفات الصور المُزالة بعد نجاح المعاملة — لو فشلت لبقيت الصور
  // مشار إليها في قاعدة البيانات بلا ملفات
  for (const url of removedImages) {
    await removeImage(url);
  }

  return { ok: true, id, slug };
}

function baseFields(input: ProductInput) {
  return {
    name: input.name,
    shortDescription: input.shortDescription ?? null,
    description: input.description ?? null,
    categoryId: input.categoryId || null,
    inspirationBrandId: input.inspirationBrandId || null,
    inspirationName: input.inspirationName ?? null,
    gender: input.gender,
    fragranceFamily: input.fragranceFamily ?? null,
    longevity: input.longevity,
    sillage: input.sillage,
    season: input.seasons.join(',') || null,
    occasion: input.occasions.join(',') || null,
    timeOfDay: input.timeOfDay ?? null,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    isNew: input.isNew,
    isBestSeller: input.isBestSeller,
    isLimited: input.isLimited,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    ogImage: input.ogImage ?? null,
    keywords: input.keywords ?? null,
  };
}

/** يعيد بناء عمود البحث بعد أي تعديل — وإلا لم يعد المنتج يظهر في البحث */
/**
 * يعيد حساب `minPrice` = أقل سعر بين الأحجام **المفعّلة**.
 *
 * لماذا عمود مخزَّن: السعر المعروض على البطاقة هو أقل سعر بين الأحجام، وهو
 * غير موجود في أي عمود. كان الترتيب بالسعر لذلك يجلب حتى ٥٠٠ منتج ويرتّبها
 * في الذاكرة — بطيء، وأسوأ من ذلك أنه **يبتر الكتالوج بصمت** عند تجاوز
 * ٥٠٠ منتج. بهذا العمود صار الترتيب في SQL بترقيم حقيقي وبلا سقف.
 *
 * صفر يعني «بلا أحجام مفعّلة» — وهذه المنتجات لا تظهر في المتجر أصلًا.
 */
async function refreshMinPrice(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const cheapest = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _min: { price: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: { minPrice: cheapest._min.price ?? 0 },
  });
}

async function refreshSearchText(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      inspirationName: true,
      fragranceFamily: true,
      keywords: true,
      shortDescription: true,
      inspirationBrand: { select: { name: true, aliases: true } },
      category: { select: { name: true } },
      notes: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  if (!product) return;

  await tx.product.update({
    where: { id: productId },
    data: { searchText: buildSearchText(product) },
  });
}

// ─────────────────────────── الحذف والإخفاء ───────────────────────────

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * حذف منتج.
 *
 * إن كان قد بيع من قبل نرفض الحذف ونقترح الإخفاء: حذفه يُفرغ مراجع
 * `order_items` ويكسر تقارير المبيعات، بينما الإخفاء يزيله من المتجر
 * ويُبقي التاريخ سليمًا.
 */
export async function deleteProduct(id: string): Promise<DeleteResult> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      images: { select: { url: true } },
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) return { ok: false, error: 'المنتج غير موجود' };

  if (product._count.orderItems > 0) {
    return {
      ok: false,
      error:
        'لا يمكن حذف منتج بيع من قبل — سيكسر ذلك سجل الطلبات. أخفِه بدل حذفه.',
    };
  }

  await prisma.product.delete({ where: { id } });

  for (const image of product.images) {
    await removeImage(image.url);
  }

  return { ok: true };
}

export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<DeleteResult> {
  const updated = await prisma.product
    .update({ where: { id }, data: { isActive }, select: { id: true } })
    .catch(() => null);

  return updated ? { ok: true } : { ok: false, error: 'المنتج غير موجود' };
}

// ─────────────────────────── القراءة ───────────────────────────

export async function getAdminProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      categoryId: true,
      inspirationBrandId: true,
      inspirationName: true,
      gender: true,
      fragranceFamily: true,
      longevity: true,
      sillage: true,
      season: true,
      occasion: true,
      timeOfDay: true,
      isActive: true,
      isFeatured: true,
      isNew: true,
      isBestSeller: true,
      isLimited: true,
      metaTitle: true,
      metaDescription: true,
      ogImage: true,
      keywords: true,
      images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
      notes: {
        orderBy: { sortOrder: 'asc' },
        select: { type: true, name: true },
      },
      variants: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          label: true,
          sizeMl: true,
          price: true,
          comparePrice: true,
          stock: true,
          lowStockThreshold: true,
          isActive: true,
        },
      },
      type: true,
      bundleItems: {
        orderBy: { sortOrder: 'asc' },
        select: {
          quantity: true,
          itemVariant: {
            select: {
              id: true,
              label: true,
              stock: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export type AdminProduct = NonNullable<
  Awaited<ReturnType<typeof getAdminProduct>>
>;

const PRODUCTS_PAGE_SIZE = 25;

export async function queryAdminProducts(params: {
  search?: string;
  status?: string;
  categoryId?: string;
  page: number;
}) {
  const and: Prisma.ProductWhereInput[] = [];

  if (params.search) {
    and.push({
      OR: [
        { name: { contains: params.search } },
        { slug: { contains: params.search } },
        { inspirationName: { contains: params.search } },
      ],
    });
  }

  if (params.status === 'hidden') and.push({ isActive: false });
  if (params.status === 'active') and.push({ isActive: true });
  if (params.categoryId) and.push({ categoryId: params.categoryId });

  const where: Prisma.ProductWhereInput = and.length > 0 ? { AND: and } : {};

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (params.page - 1) * PRODUCTS_PAGE_SIZE,
      take: PRODUCTS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        gender: true,
        isActive: true,
        isFeatured: true,
        salesCount: true,
        viewCount: true,
        category: { select: { name: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { url: true },
        },
        variants: {
          select: { price: true, stock: true, isActive: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: rows,
    total,
    page: params.page,
    totalPages: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}

/**
 * الأحجام المتاحة للاختيار داخل باقة.
 *
 * نستثني الباقات نفسها — باقة داخل باقة تُنتج تداخلًا لا معنى له وتُعقّد
 * حساب المخزون بلا فائدة.
 */
export async function getBundleCandidates() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { type: 'simple' } },
    orderBy: [{ product: { name: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true,
      label: true,
      price: true,
      stock: true,
      product: { select: { id: true, name: true } },
    },
  });

  return variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    price: variant.price,
    stock: variant.stock,
    productId: variant.product.id,
    productName: variant.product.name,
  }));
}

/** الخيارات المطلوبة لنموذج المنتج */
export async function getProductFormOptions() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.inspirationBrand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return { categories, brands };
}
