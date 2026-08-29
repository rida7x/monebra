import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { changeOrderStatus } from '@/lib/services/orders';
import { invalidateProduct } from '@/lib/cache';
import { ORDER_STATUSES } from '@/lib/constants';
import { logError } from '@/lib/logger';

/**
 * تغيير حالة الطلب.
 *
 * ⚠️ الصلاحية تُفحص هنا وليس في الواجهة فقط: إخفاء الأزرار في الشريط
 * الجانبي تحسين للتجربة، أما المنع الحقيقي فهنا. من لا يملك
 * `orders.manage` يُرفض حتى لو استدعى المسار مباشرة.
 *
 * منطق الانتقال وأثره على المخزون في `changeOrderStatus` — نقطة النهاية
 * لا تكرّره ولا تلتف عليه.
 */

const Schema = z.object({
  status: z.enum(ORDER_STATUSES, { message: 'حالة غير معروفة' }),
  note: z.string().trim().max(500).nullish(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('orders.manage');
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'الحالة المطلوبة غير معروفة' },
        { status: 400 },
      );
    }

    const result = await changeOrderStatus(
      id,
      parsed.data.status,
      admin.id,
      parsed.data.note ?? null,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    // الإلغاء والإرجاع يعيدان المخزون ⇒ شارات التوفر في المتجر تغيّرت
    try {
      invalidateProduct();
    } catch {
      // الإبطال تحسين للعرض — لا يُفشل عملية نجحت
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية تغيير حالة الطلبات' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/orders/[id]/status' });

    return NextResponse.json(
      { error: 'تعذّر تغيير الحالة. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
