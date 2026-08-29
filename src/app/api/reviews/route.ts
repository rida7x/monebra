import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/utils';
import { logError } from '@/lib/logger';

/**
 * إضافة تقييم من العميل.
 *
 * قواعد مقصودة:
 *  • **التقييم مرتبط بشراء فعلي**: نطلب رقم الهاتف ونتحقق أن صاحبه اشترى
 *    هذا المنتج. بدون هذا القيد يمتلئ المتجر بتقييمات وهمية — من منافس
 *    أو من صاحب المتجر نفسه — وتفقد التقييمات قيمتها كليًا.
 *  • **تقييم واحد لكل عميل لكل منتج**، وإلا رفع أحدهم تقييمه عشر مرات.
 *  • المراجعة قبل النشر افتراضيًا، ويتحكم بها المدير من الإعدادات.
 */

const Schema = z.object({
  productId: z.string().min(1).max(64),
  rating: z
    .number()
    .int('التقييم يجب أن يكون عددًا صحيحًا')
    .min(1, 'اختر تقييمًا من ١ إلى ٥')
    .max(5, 'التقييم يجب أن يكون من ١ إلى ٥'),
  comment: z.string().trim().max(1000).nullish(),
  customerName: z.string().trim().min(2, 'أدخل اسمك').max(80),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(25)
    .refine((value) => normalizePhone(value) !== null, {
      message: 'رقم الهاتف غير صحيح',
    }),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  try {
    const limit = await rateLimit(`review:${ip}`, LIMITS.review().limit, LIMITS.review().windowSeconds);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' },
        { status: 429 },
      );
    }

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير مكتملة' },
        { status: 400 },
      );
    }

    const { productId, rating, comment, customerName } = parsed.data;
    const phone = normalizePhone(parsed.data.phone)!;

    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true, slug: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    // ── التحقق من الشراء ──
    const purchase = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          customerPhone: phone,
          // لا نقبل تقييمًا من طلب ملغي — لم يستلم العميل العطر أصلًا
          status: { notIn: ['cancelled', 'returned'] },
        },
      },
      select: { orderId: true },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          error:
            'لم نجد طلبًا لهذا العطر برقم هاتفك. التقييم متاح لمن اشترى المنتج فقط.',
        },
        { status: 403 },
      );
    }

    const existing = await prisma.review.findFirst({
      where: { productId, phone },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'سبق أن قيّمت هذا العطر. شكرًا لك!' },
        { status: 409 },
      );
    }

    const settings = await getSettings();
    const status = settings.reviewsRequireApproval ? 'pending' : 'approved';

    await prisma.review.create({
      data: {
        productId,
        orderId: purchase.orderId,
        customerName,
        phone,
        rating,
        comment: comment || null,
        status,
      },
    });

    await prisma.notification.create({
      data: {
        type: 'new_review',
        title: `تقييم جديد (${rating}/5)`,
        body: `${customerName} — بانتظار المراجعة`,
        entityType: 'product',
        entityId: productId,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      status,
      message:
        status === 'approved'
          ? 'شكرًا لك! نُشر تقييمك.'
          : 'شكرًا لك! سيظهر تقييمك بعد مراجعته.',
    });
  } catch (error) {
    await logError(error, { path: '/api/reviews', ip });

    return NextResponse.json(
      { error: 'تعذّر إرسال التقييم. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
