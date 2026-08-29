import { NextResponse, type NextRequest } from 'next/server';
import { validateCart, sanitizeLines, EMPTY_CART } from '@/lib/services/cart';
import { getSettings } from '@/lib/settings';
import { logError } from '@/lib/logger';

/**
 * تسعير السلة والتحقق منها.
 *
 * المتصفح يرسل `[{ variantId, quantity }]` فقط. الخادم يعيد الأسماء والصور
 * والأسعار والإجماليات محسوبة من قاعدة البيانات، مع قائمة «مشاكل» توضح ما
 * تغيّر منذ إضافة العميل للمنتج (نفد، حُذف، قلّت الكمية المتاحة).
 *
 * لا تخزين مؤقت: السلة يجب أن تعكس المخزون لحظيًا.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const lines = sanitizeLines((body as { lines?: unknown })?.lines);

    const [cart, settings] = await Promise.all([
      lines.length > 0 ? validateCart(lines) : Promise.resolve(EMPTY_CART),
      getSettings(),
    ]);

    return NextResponse.json(
      {
        ...cart,
        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        ordersEnabled: settings.ordersEnabled,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    await logError(error, { path: '/api/cart/validate' });

    return NextResponse.json(
      { error: 'تعذّر تحديث السلة حاليًا. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
