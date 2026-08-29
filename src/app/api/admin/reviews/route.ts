import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { invalidateReviews } from '@/lib/cache';
import { REVIEW_STATUSES } from '@/lib/constants';
import { logError } from '@/lib/logger';

/**
 * مراجعة التقييمات.
 *
 * المدير يوافق أو يخفي — ولا يستطيع **تعديل نص التقييم أو نجومه**. تعديل
 * كلام العميل يحوّل التقييمات إلى دعاية ويفقدها مصداقيتها؛ إن كان التقييم
 * مسيئًا فالإخفاء هو الإجراء الصحيح.
 */

const Schema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(REVIEW_STATUSES, { message: 'حالة غير معروفة' }),
  adminNote: z.string().trim().max(300).nullish(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin('reviews.manage');

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' },
        { status: 400 },
      );
    }

    const review = await prisma.review.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        adminNote: parsed.data.adminNote ?? null,
      },
      select: { productId: true, product: { select: { slug: true } } },
    }).catch(() => null);

    if (!review) {
      return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });
    }

    invalidateReviews(review.product.slug, review.productId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'PATCH /api/admin/reviews');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin('reviews.manage');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'المعرّف مفقود' }, { status: 400 });
    }

    const review = await prisma.review.delete({
      where: { id },
      select: { productId: true, product: { select: { slug: true } } },
    }).catch(() => null);

    if (!review) {
      return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });
    }

    invalidateReviews(review.product.slug, review.productId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE /api/admin/reviews');
  }
}

async function handle(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية إدارة التقييمات' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
