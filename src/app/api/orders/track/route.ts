import { NextResponse, type NextRequest } from 'next/server';
import { trackOrder } from '@/lib/services/orders';
import { getSettings } from '@/lib/settings';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

/**
 * تتبّع الطلب.
 *
 * يشترط رقم الطلب **ورقم الهاتف** معًا. أرقام الطلبات متسلسلة ويسهل
 * تخمينها، فبدون الهاتف يستطيع أي شخص قراءة عناوين العملاء وأرقامهم.
 *
 * تحديد المعدّل يمنع تجربة أرقام هواتف كثيرة على نفس الطلب، والرسالة
 * موحّدة عند الفشل حتى لا يعرف المهاجم أي الحقلين كان صحيحًا.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  try {
    const limit = await rateLimit(`track:${ip}`, LIMITS.track().limit, LIMITS.track().windowSeconds);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      orderNumber?: unknown;
      phone?: unknown;
    } | null;

    const orderNumber =
      typeof body?.orderNumber === 'string'
        ? body.orderNumber.trim().slice(0, 32)
        : '';
    const phone =
      typeof body?.phone === 'string' ? body.phone.trim().slice(0, 25) : '';

    if (!orderNumber || !phone) {
      return NextResponse.json(
        { error: 'أدخل رقم الطلب ورقم الهاتف.' },
        { status: 400 },
      );
    }

    const order = await trackOrder(orderNumber, phone);

    if (!order) {
      // رسالة واحدة للحالتين — لا نكشف أي الحقلين كان صحيحًا
      return NextResponse.json(
        { error: 'لم نجد طلبًا بهذا الرقم مرتبطًا برقم الهاتف المُدخل.' },
        { status: 404 },
      );
    }

    const settings = await getSettings();

    return NextResponse.json(
      {
        order,
        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    await logError(error, { path: '/api/orders/track', ip });

    return NextResponse.json(
      { error: 'تعذّر تتبّع الطلب حاليًا. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
