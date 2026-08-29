import { NextResponse, type NextRequest } from 'next/server';
import { validateCart, sanitizeLines } from '@/lib/services/cart';
import { computeOrderTotals } from '@/lib/services/pricing';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/utils';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

/**
 * عرض سعر الطلب قبل تأكيده.
 *
 * تستدعيها صفحة إتمام الطلب كلما تغيّرت المدينة أو المنطقة أو كود الخصم،
 * فيرى العميل رسوم التوصيل والإجمالي النهائي قبل الضغط على «تأكيد».
 *
 * ⚠️ تستخدم نفس `computeOrderTotals` التي يستخدمها إنشاء الطلب فعليًا،
 * فما يُعرض هنا هو ما سيُسجَّل هناك بالضبط.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit(`quote:${clientIp(request)}`, LIMITS.quote().limit, LIMITS.quote().windowSeconds);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'طلبات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      lines?: unknown;
      cityId?: unknown;
      areaId?: unknown;
      couponCode?: unknown;
      phone?: unknown;
    } | null;

    const lines = sanitizeLines(body?.lines);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'سلّتك فارغة.' },
        { status: 400 },
      );
    }

    const cityId = typeof body?.cityId === 'string' ? body.cityId : null;
    const areaId = typeof body?.areaId === 'string' ? body.areaId : null;
    const couponCode =
      typeof body?.couponCode === 'string'
        ? body.couponCode.slice(0, 40)
        : null;
    const phone =
      typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;

    const settings = await getSettings();
    const cart = await validateCart(lines);

    const totals = await computeOrderTotals({
      cart,
      cityId,
      areaId,
      couponCode,
      customerPhone: phone,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
    });

    return NextResponse.json(
      {
        items: cart.items,
        issues: cart.issues,
        itemCount: cart.itemCount,

        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        savings: totals.savings,
        freeDeliveryApplied: totals.freeDeliveryApplied,

        coupon: totals.coupon
          ? { code: totals.coupon.code, amount: totals.coupon.amount }
          : null,
        couponError: totals.couponError,

        delivery: totals.delivery
          ? {
              cityName: totals.delivery.cityName,
              areaName: totals.delivery.areaName,
              days: totals.delivery.days,
            }
          : null,

        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
        ordersEnabled: settings.ordersEnabled,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    await logError(error, { path: '/api/checkout/quote' });

    return NextResponse.json(
      { error: 'تعذّر حساب الطلب حاليًا. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
