import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { verifyWebhookSignature } from '@/lib/payments/dpay';

/**
 * تأكيد الدفع من DPay.
 *
 * هذه النقطة هي **المصدر الوحيد** الذي يُعلَّم به طلب مدفوعًا. نجاح إدخال
 * رمز التحقق في المتصفح مؤشّر يُطمئن الزبون لا إثبات: ردّ يمرّ عبر جهاز
 * الزبون لا يُبنى عليه مال.
 *
 * ⚠️ مفتوحة للعالم بالضرورة — DPay تناديها من خوادمها بلا جلسة. ما يحميها
 * هو التوقيع وحده، فلا يُقرأ الجسم قبل التحقق منه.
 *
 * ⚠️ الردّ يجب أن يكون 2xx وأسرع من ١٥ ثانية، وإلا أعادت DPay الإرسال حتى
 * خمس مرات. ولهذا نردّ 200 حتى على حدث لا يخصّنا: إعادة المحاولة لن تُصلح
 * شيئًا، وستملأ سجلّنا بلا فائدة.
 */

type DpayWebhook = {
  event?: string;
  live?: boolean;
  session_id?: number;
  status?: string;
  amount?: number;
  pay_method?: string;
  tx_id?: string | null;
  system_reference?: string | null;
  network_reference?: string | null;
  paid_at?: string | null;
  data?: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  /**
   * ⚠️ الجسم الخام لا `request.json()`. التوقيع محسوب على النصّ كما أُرسل،
   * وتحليل JSON ثم إعادة تسلسله يغيّر ترتيب المفاتيح والمسافات فيفشل
   * توقيع صحيح تمامًا.
   */
  const rawBody = await request.text();

  const valid = verifyWebhookSignature(
    rawBody,
    request.headers.get('x-dpay-signature'),
    request.headers.get('x-dpay-timestamp'),
  );

  if (!valid) {
    // 401 لا 200: توقيع فاسد ليس حدثًا لا يخصّنا، بل محاولة يجب أن تُرفض
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: DpayWebhook;

  try {
    payload = JSON.parse(rawBody) as DpayWebhook;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const sessionId = payload.session_id;

  if (!sessionId) {
    return NextResponse.json({ ok: true, ignored: 'no session' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { paymentSessionId: String(sessionId) },
      select: { id: true, orderNumber: true, total: true, paymentStatus: true },
    });

    if (!order) {
      // حدث لجلسة ليست لنا (أو لمشروع آخر على نفس الحساب) — ليس خطأً
      return NextResponse.json({ ok: true, ignored: 'unknown session' });
    }

    switch (payload.event) {
      case 'payment.paid': {
        /**
         * ⚠️ الحماية من التكرار: DPay قد تُسلّم الحدث أكثر من مرة، والوثائق
         * تنصّ على استعمال `session_id + event` مفتاحًا. الشرط في `where`
         * يجعل التكرار لا أثر له: التحديث الثاني لا يطابق شيئًا.
         */
        await prisma.order.updateMany({
          where: { id: order.id, paymentStatus: { not: 'paid' } },
          data: {
            paymentStatus: 'paid',
            paidAt: payload.paid_at ? new Date(payload.paid_at) : new Date(),
            paymentReference:
              payload.tx_id ??
              payload.system_reference ??
              payload.network_reference ??
              null,
          },
        });

        break;
      }

      case 'payment.failed':
      case 'payment.expired': {
        await prisma.order.updateMany({
          where: { id: order.id, paymentStatus: 'pending' },
          data: { paymentStatus: 'failed' },
        });

        break;
      }

      case 'payment.refunded':
      case 'payment.voided': {
        await prisma.order.updateMany({
          where: { id: order.id },
          data: { paymentStatus: 'refunded' },
        });

        break;
      }

      default:
        // webhook.test وما يُضاف مستقبلًا — نردّ بنجاح ولا نفعل شيئًا
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError(error, {
      path: '/api/payments/dpay/webhook',
      event: payload.event,
      sessionId,
    });

    // 500 هنا مقصود: هذا عطل عندنا، وإعادة محاولة DPay قد تنجح
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
