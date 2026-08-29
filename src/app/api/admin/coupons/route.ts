import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { toMinor } from '@/lib/money';
import { logError } from '@/lib/logger';

/**
 * إدارة الكوبونات.
 *
 * ⚠️ منطق التحقق من الكوبون وحساب خصمه في `lib/services/pricing.ts` ولا
 * يُكرَّر هنا — هذه النقطة تحفظ التعريف فقط. الفصل مقصود: أي تعديل على
 * قواعد الخصم يحدث في مكان واحد يستخدمه العرض والحفظ معًا.
 *
 * الكوبون المستخدَم في طلبات لا يُحذف: حذفه يُفرغ مرجع `orders.couponId`
 * ويجعل تفسير خصومات قديمة مستحيلًا. يُعطَّل بدل ذلك.
 */

const Schema = z
  .object({
    id: z.string().max(64).optional(),
    code: z
      .string()
      .trim()
      .min(3, 'الكود قصير جدًا')
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, 'الكود يقبل حروفًا لاتينية وأرقامًا وشرطات فقط'),
    description: z.string().trim().max(200).nullish(),
    type: z.enum(['percent', 'fixed'], { message: 'نوع الخصم غير معروف' }),
    /** نسبة مئوية (1-100) أو مبلغ بالصيغة المعروضة */
    value: z.number().positive('قيمة الخصم يجب أن تكون أكبر من صفر'),
    minOrderTotal: z.number().min(0).max(1_000_000),
    maxDiscount: z.number().min(0).max(1_000_000).nullish(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullish(),
    perCustomerLimit: z.number().int().min(1).max(1000).nullish(),
    startsAt: z.string().max(40).nullish(),
    endsAt: z.string().max(40).nullish(),
    isActive: z.boolean(),
  })
  .refine(
    (data) => data.type !== 'percent' || data.value <= 100,
    { message: 'نسبة الخصم لا تتجاوز ١٠٠٪', path: ['value'] },
  );

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('coupons.manage');

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات الكوبون غير مكتملة' },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const code = data.code.toUpperCase();

    const startsAt = parseDate(data.startsAt);
    const endsAt = parseDate(data.endsAt);

    if (startsAt && endsAt && endsAt <= startsAt) {
      return NextResponse.json(
        { error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' },
        { status: 400 },
      );
    }

    const clash = await prisma.coupon.findUnique({
      where: { code },
      select: { id: true },
    });

    if (clash && clash.id !== data.id) {
      return NextResponse.json(
        { error: 'يوجد كوبون بهذا الكود بالفعل' },
        { status: 409 },
      );
    }

    const payload = {
      code,
      description: data.description || null,
      type: data.type,
      // النسبة تُحفظ كما هي؛ المبلغ الثابت يُحوَّل للوحدة الصغرى
      value: data.type === 'percent' ? Math.round(data.value) : toMinor(data.value),
      minOrderTotal: toMinor(data.minOrderTotal),
      maxDiscount: data.maxDiscount != null ? toMinor(data.maxDiscount) : null,
      usageLimit: data.usageLimit ?? null,
      perCustomerLimit: data.perCustomerLimit ?? null,
      startsAt,
      endsAt,
      isActive: data.isActive,
    };

    const coupon = data.id
      ? await prisma.coupon.update({
          where: { id: data.id },
          data: payload,
          select: { id: true },
        })
      : await prisma.coupon.create({ data: payload, select: { id: true } });

    return NextResponse.json({ ok: true, id: coupon.id });
  } catch (error) {
    return handle(error, 'POST /api/admin/coupons');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin('coupons.manage');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'المعرّف مفقود' }, { status: 400 });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      select: { usageCount: true, _count: { select: { orders: true } } },
    });

    if (!coupon) {
      return NextResponse.json({ error: 'الكوبون غير موجود' }, { status: 404 });
    }

    if (coupon._count.orders > 0) {
      return NextResponse.json(
        {
          error: `استُخدم هذا الكوبون في ${coupon._count.orders} طلبًا — حذفه يكسر تفسير خصوماتها. عطّله بدل حذفه.`,
        },
        { status: 409 },
      );
    }

    await prisma.coupon.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE /api/admin/coupons');
  }
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function handle(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية إدارة الكوبونات' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
