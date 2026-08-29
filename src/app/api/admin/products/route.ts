import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createProduct, updateProduct } from '@/lib/services/admin-products';
import { invalidateProduct, invalidateCategories } from '@/lib/cache';
import { toMinor } from '@/lib/money';
import { GENDERS, SEASONS, OCCASIONS, TIME_OF_DAY, NOTE_TYPES } from '@/lib/constants';
import { logError } from '@/lib/logger';

/**
 * حفظ منتج (إنشاء أو تعديل).
 *
 * ⚠️ الأسعار تصل من النموذج كأرقام معروضة (45.5) وتُحوَّل هنا إلى الوحدة
 * الصغرى (45500) عبر `toMinor` — هذه هي **النقطة الوحيدة** في النظام التي
 * يحدث فيها هذا التحويل عند الكتابة. ما بعدها أعداد صحيحة فقط.
 */

const MoneySchema = z
  .number()
  .min(0, 'السعر لا يمكن أن يكون سالبًا')
  .max(2_000_000, 'السعر كبير جدًا');

const VariantSchema = z.object({
  id: z.string().max(64).optional(),
  label: z.string().trim().min(1, 'اسم الحجم مطلوب').max(60),
  sizeMl: z.number().int().min(0).max(10_000).nullish(),
  price: MoneySchema,
  comparePrice: MoneySchema.nullish(),
  stock: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});

const ProductSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.enum(['simple', 'bundle'], { message: 'نوع المنتج غير معروف' }).optional(),
  bundleItems: z
    .array(
      z.object({
        variantId: z.string().min(1).max(64),
        quantity: z
          .number()
          .int('الكمية يجب أن تكون عددًا صحيحًا')
          .min(1, 'كمية كل صنف في الباقة واحد على الأقل')
          .max(20, 'كمية الصنف الواحد لا تتجاوز ٢٠'),
      }),
    )
    .max(12)
    .optional(),
  name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(160),
  slug: z.string().trim().max(160).optional(),
  shortDescription: z.string().trim().max(300).nullish(),
  description: z.string().trim().max(5000).nullish(),
  categoryId: z.string().max(64).nullish(),
  inspirationBrandId: z.string().max(64).nullish(),
  inspirationName: z.string().trim().max(160).nullish(),
  gender: z.enum(GENDERS, { message: 'اختر الجنس من القائمة' }),
  fragranceFamily: z.string().trim().max(80).nullish(),
  longevity: z.number().int().min(1).max(5),
  sillage: z.number().int().min(1).max(5),
  seasons: z.array(z.enum(SEASONS, { message: 'موسم غير معروف' })).max(4),
  occasions: z.array(z.enum(OCCASIONS, { message: 'مناسبة غير معروفة' })).max(4),
  timeOfDay: z.enum(TIME_OF_DAY, { message: 'وقت غير معروف' }).nullish(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isBestSeller: z.boolean(),
  isLimited: z.boolean(),
  metaTitle: z.string().trim().max(160).nullish(),
  metaDescription: z.string().trim().max(300).nullish(),
  // مسار داخلي فقط — نمنع رابطًا خارجيًا يسرّب زيارات أو يُستخدم للتتبّع
  ogImage: z
    .string()
    .trim()
    .max(400)
    .refine((value) => value.startsWith('/'), 'صورة المشاركة يجب أن تكون من صور المنتج')
    .nullish(),
  keywords: z.string().trim().max(300).nullish(),
  images: z.array(z.string().max(400)).max(10, 'الحد الأقصى ١٠ صور'),
  notes: z
    .array(
      z.object({
        type: z.enum(NOTE_TYPES, { message: 'نوع نوتة غير معروف' }),
        name: z.string().trim().min(1).max(60),
      }),
    )
    .max(30),
  variants: z.array(VariantSchema).min(1, 'أضف حجمًا واحدًا على الأقل').max(10),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('products.manage');

    const body = await request.json().catch(() => null);
    const parsed = ProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات المنتج غير مكتملة' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // كل الصور يجب أن تكون من مجلد الرفع — يمنع حقن روابط خارجية
    const badImage = data.images.find((url) => !url.startsWith('/uploads/'));
    if (badImage) {
      return NextResponse.json(
        { error: 'رابط صورة غير صالح. ارفع الصور من هذه الصفحة.' },
        { status: 400 },
      );
    }

    // الباقة يجب أن تضم صنفًا واحدًا على الأقل، وإلا فهي منتج عادي بلا محتوى
    if (data.type === 'bundle' && (data.bundleItems ?? []).length === 0) {
      return NextResponse.json(
        { error: 'أضف صنفًا واحدًا على الأقل إلى الباقة' },
        { status: 400 },
      );
    }

    // نتحقق أن كل حجم في الباقة موجود فعلًا — يمنع باقة تشير إلى عدم
    if (data.type === 'bundle' && data.bundleItems?.length) {
      const ids = data.bundleItems.map((item) => item.variantId);
      const found = await prisma.productVariant.count({
        where: { id: { in: ids } },
      });

      if (found !== new Set(ids).size) {
        return NextResponse.json(
          { error: 'أحد الأحجام المختارة في الباقة لم يعد موجودًا' },
          { status: 400 },
        );
      }
    }

    const input = {
      ...data,
      seasons: [...data.seasons],
      occasions: [...data.occasions],
      notes: data.notes.map((note) => ({ ...note })),
      variants: data.variants.map((variant) => ({
        ...variant,
        price: toMinor(variant.price),
        comparePrice:
          variant.comparePrice != null ? toMinor(variant.comparePrice) : null,
      })),
    };

    // السعر قبل الخصم يجب أن يكون أعلى من السعر، وإلا فهو خصم سالب
    const invalid = input.variants.find(
      (variant) =>
        variant.comparePrice !== null && variant.comparePrice <= variant.price,
    );

    if (invalid) {
      return NextResponse.json(
        {
          error: `السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي (${invalid.label})`,
        },
        { status: 400 },
      );
    }

    const result = data.id
      ? await updateProduct(data.id, input)
      : await createProduct(input);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    invalidateProduct(result.slug);
    invalidateCategories();

    return NextResponse.json({ ok: true, id: result.id, slug: result.slug });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية إدارة المنتجات' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/products' });

    return NextResponse.json(
      { error: 'تعذّر حفظ المنتج. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
