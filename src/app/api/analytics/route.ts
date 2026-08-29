import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { deviceTypeOf, rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * تسجيل حدث تحليلي.
 *
 * ⚠️ مبادئ خصوصية مقصودة:
 *  • لا نخزّن عنوان IP ولا أي معرّف دائم للزائر
 *  • `sessionId` معرّف عشوائي يعيش في `sessionStorage` وينتهي بإغلاق
 *    التبويب — يكفي لقياس معدّل التحويل ولا يتتبّع أحدًا عبر الزيارات
 *  • لا نستخدم أي خدمة تحليلات خارجية، فلا تُرسَل بيانات العملاء لأي جهة
 *
 * الاستجابة `204` بلا جسم: الحدث تحسين للإحصائيات ولا يجوز أن يبطئ
 * تصفّح العميل أو يُفشل صفحة.
 */

const ALLOWED = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'begin_checkout',
]);

export async function POST(request: NextRequest) {
  try {
    // حد سخيّ — الأحداث كثيرة بطبيعتها، والغرض منع الإغراق فقط
    const limit = await rateLimit(`analytics:${clientIp(request)}`, 300, 60);
    if (!limit.allowed) return new NextResponse(null, { status: 204 });

    const body = (await request.json().catch(() => null)) as {
      type?: unknown;
      productId?: unknown;
      sessionId?: unknown;
      path?: unknown;
    } | null;

    const type = typeof body?.type === 'string' ? body.type : '';
    if (!ALLOWED.has(type)) return new NextResponse(null, { status: 204 });

    await prisma.analyticsEvent.create({
      data: {
        type,
        productId:
          typeof body?.productId === 'string' && body.productId.length <= 64
            ? body.productId
            : null,
        sessionId:
          typeof body?.sessionId === 'string' && body.sessionId.length <= 64
            ? body.sessionId
            : null,
        deviceType: deviceTypeOf(request.headers.get('user-agent')),
        path:
          typeof body?.path === 'string' ? body.path.slice(0, 255) : null,
        referrer: request.headers.get('referer')?.slice(0, 255) ?? null,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // التحليلات لا تُفشل شيئًا أبدًا — نبتلع الخطأ بصمت
    return new NextResponse(null, { status: 204 });
  }
}
