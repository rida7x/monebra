import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { isPaymentMethodEnabled } from '@/lib/payments';
import { openSession, verifySession, type DpayMethod } from '@/lib/payments/dpay';

/**
 * فتح جلسة دفع لطلب قائم، وتأكيدها برمز التحقق.
 *
 * ── لماذا بعد إنشاء الطلب لا قبله ─────────────────────────────────
 * الطلب يُنشأ أولًا بحالة `pending`، ثم تُفتح جلسة الدفع له. هكذا يبقى أثر
 * لكل محاولة: زبون دفع ثم انقطع اتصاله يجد طلبه موجودًا وتاجره يراه، بدل
 * أن يختفي المال بلا طلب يقابله.
 *
 * ⚠️ المبلغ يُقرأ من الطلب في قاعدتنا. لو قُرئ من الطلبية القادمة لأمكن
 * لأي زبون أن يدفع دينارًا مقابل سلة بألف.
 */

const OpenSchema = z.object({
  action: z.literal('open'),
  orderNumber: z.string().trim().min(3).max(40),
  /** يُتحقق منه بهاتف الطلب — لا يكفي رقم الطلب وحده */
  phone: z.string().trim().min(6).max(25),
  method: z.enum(['mobicash', 'edfali']),
  /** أدفعلي: رقم الهاتف — موبي كاش: رقم البطاقة (٧ أرقام) */
  account: z.string().trim().min(6).max(20),
});

const VerifySchema = z.object({
  action: z.literal('verify'),
  orderNumber: z.string().trim().min(3).max(40),
  phone: z.string().trim().min(6).max(25),
  otp: z.string().trim().min(4).max(8),
});

const Schema = z.discriminatedUnion('action', [OpenSchema, VerifySchema]);

/**
 * يجلب الطلب بشرط مطابقة الهاتف.
 *
 * ⚠️ رقم الطلب وحده لا يكفي: أرقامنا متسلسلة (`MON-10025`) فتخمينها سهل،
 * وبدون الهاتف يستطيع أي شخص فتح جلسة دفع على طلب غيره — أو أسوأ، قراءة
 * حالته. الهاتف ليس سرًّا قويًا لكنه يرفع التخمين من «متسلسل» إلى «زوج».
 */
async function findOrder(orderNumber: string, phone: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      customerPhone: true,
      total: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentSessionId: true,
    },
  });

  if (!order) return null;

  const digits = (value: string) => value.replace(/\D/g, '').slice(-9);

  return digits(order.customerPhone) === digits(phone) ? order : null;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  try {
    const limit = await rateLimit(
      `dpay:${ip}`,
      LIMITS.order().limit,
      LIMITS.order().windowSeconds,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' },
        { status: 429 },
      );
    }

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const input = parsed.data;
    const order = await findOrder(input.orderNumber, input.phone);

    if (!order) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }

    // ── فتح جلسة ──
    if (input.action === 'open') {
      if (!isPaymentMethodEnabled(input.method)) {
        return NextResponse.json(
          { error: 'طريقة الدفع هذه غير متاحة حاليًا' },
          { status: 400 },
        );
      }

      const method = input.method as DpayMethod;

      const result = await openSession({
        method,
        amountMinor: order.total,
        customerMobile: method === 'edfali' ? input.account : undefined,
        cardNumber: method === 'mobicash' ? input.account : undefined,
        description: `طلب ${order.orderNumber}`,
        // يعود إلينا في الـ webhook فنعرف الطلب حتى لو تغيّر شيء
        data: { order_number: order.orderNumber },
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: input.method,
          paymentSessionId: String(result.data.session_id),
        },
      });

      return NextResponse.json({
        ok: true,
        sessionId: result.data.session_id,
        expiresAt: result.data.expired_at ?? null,
      });
    }

    // ── تأكيد الرمز ──
    if (!order.paymentSessionId) {
      return NextResponse.json(
        { error: 'لم تُفتح جلسة دفع لهذا الطلب' },
        { status: 400 },
      );
    }

    const result = await verifySession(
      Number(order.paymentSessionId),
      input.otp,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    /**
     * ⚠️ لا نعلّم الطلب مدفوعًا هنا. نجاح التأكيد يعني أن الزبون أدخل رمزًا
     * صحيحًا، والتعليم يجري في الـ webhook الموقّع وحده. الردّ هنا لإطمئنان
     * الزبون فقط — وقد يصل الـ webhook قبل أن يقرأه أصلًا.
     */
    return NextResponse.json({ ok: true, status: result.data.status });
  } catch (error) {
    await logError(error, { path: '/api/payments/dpay/session' });

    return NextResponse.json(
      { error: 'تعذّر إتمام الدفع. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
