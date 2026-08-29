import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { invalidateProduct } from '@/lib/cache';
import { logError } from '@/lib/logger';

/**
 * تعديل المخزون يدويًا.
 *
 * كل تعديل يُسجَّل كحركة في `inventory_movements` باسم من نفّذه — فسجل
 * المخزون يبقى قابلًا للتدقيق ويمكن تتبّع أي فرق بين المخزون الحقيقي
 * والمسجَّل.
 *
 * نستخدم الفرق (delta) لا القيمة المطلقة عند الإضافة/الخصم السريع، أما
 * «تعيين» فيحسب الفرق ويسجّله.
 */

const Schema = z.object({
  variantId: z.string().min(1).max(64),
  /** القيمة الجديدة للمخزون */
  stock: z.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(300).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('inventory.manage');

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' },
        { status: 400 },
      );
    }

    const { variantId, stock, note } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, stock: true, product: { select: { slug: true } } },
      });

      if (!variant) return null;

      const delta = stock - variant.stock;

      if (delta === 0) {
        return { slug: variant.product.slug, unchanged: true };
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId,
          delta,
          reason: 'adjustment',
          stockAfter: stock,
          adminId: admin.id,
          note: note || 'تعديل يدوي من صفحة المخزون',
        },
      });

      return { slug: variant.product.slug, unchanged: false };
    });

    if (!result) {
      return NextResponse.json({ error: 'الحجم غير موجود' }, { status: 404 });
    }

    if (!result.unchanged) invalidateProduct(result.slug);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية تعديل المخزون' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/inventory' });

    return NextResponse.json(
      { error: 'تعذّر تحديث المخزون. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
