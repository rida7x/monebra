import { NextResponse, type NextRequest } from 'next/server';
import { quickSearch } from '@/lib/services/product-query';
import { getSettings } from '@/lib/settings';
import { sanitizeQuery } from '@/lib/search';
import { logError } from '@/lib/logger';

/**
 * البحث الفوري أثناء الكتابة.
 *
 * يعيد الحد الأدنى من الحقول لتبقى الاستجابة صغيرة على الشبكات الضعيفة.
 * الاستعلام مقصوص الطول ومحدود الكلمات في `sanitizeQuery` و`parseSearchQuery`،
 * فلا يمكن إثقال قاعدة البيانات باستعلام مصطنع.
 */
export async function GET(request: NextRequest) {
  try {
    const query = sanitizeQuery(request.nextUrl.searchParams.get('q'));

    if (query.length < 2) {
      return NextResponse.json({ query, results: [] });
    }

    const [products, settings] = await Promise.all([
      quickSearch(query, 6),
      getSettings(),
    ]);

    return NextResponse.json(
      {
        query,
        results: products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          image: product.image,
          price: product.price,
          inspirationName: product.inspirationName,
          variantCount: product.variantCount,
          outOfStock: product.stockLevel === 'out_of_stock',
        })),
        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
      },
      {
        headers: {
          // نتائج البحث تتغير مع الكتالوج — تخزين قصير على الحافة يكفي
          'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    await logError(error, { path: '/api/search' });

    return NextResponse.json(
      { error: 'تعذّر تنفيذ البحث حاليًا' },
      { status: 500 },
    );
  }
}
