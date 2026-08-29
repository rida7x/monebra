import { NextResponse } from 'next/server';
import { getDeliveryOptions } from '@/lib/services/delivery';
import { getSettings } from '@/lib/settings';
import { logError } from '@/lib/logger';

/**
 * المدن والمناطق ورسوم التوصيل.
 *
 * تُقرأ من قاعدة البيانات ويحددها المدير — لا رسوم مفترضة في الكود.
 * الاستجابة قابلة للتخزين قصيرًا لأن المدن نادرة التغيير، ويبطلها
 * `invalidateCities()` عند تعديل المدير.
 */
export async function GET() {
  try {
    const [cities, settings] = await Promise.all([
      getDeliveryOptions(),
      getSettings(),
    ]);

    return NextResponse.json(
      {
        cities,
        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    await logError(error, { path: '/api/cities' });

    return NextResponse.json(
      { error: 'تعذّر تحميل مدن التوصيل حاليًا.' },
      { status: 500 },
    );
  }
}
