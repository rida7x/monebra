import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { toCardData, CARD_SELECT } from '@/lib/services/catalog';
import { getSettings } from '@/lib/settings';
import { logError } from '@/lib/logger';

const MAX_IDS = 100;

/**
 * جلب منتجات بمعرّفاتها — تستخدمها صفحة المفضلة.
 *
 * المفضلة محفوظة في متصفح الزائر كمعرّفات، فنطلب بياناتها الحالية من هنا.
 * المنتجات المحذوفة أو المخفية لا تعود في النتيجة، فتُنظَّف القائمة تلقائيًا
 * بدل عرض بطاقات مكسورة.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const raw = (body as { ids?: unknown })?.ids;

    const ids = Array.isArray(raw)
      ? raw
          .filter(
            (id): id is string => typeof id === 'string' && id.length <= 64,
          )
          .slice(0, MAX_IDS)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const [rows, settings] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: ids }, isActive: true },
        select: CARD_SELECT,
      }),
      getSettings(),
    ]);

    // نُعيد الترتيب الذي أرسله العميل — الأحدث إضافة أولًا
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map(toCardData);

    return NextResponse.json(
      {
        products: ordered,
        currency: {
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    await logError(error, { path: '/api/products/by-ids' });

    return NextResponse.json(
      { error: 'تعذّر تحميل المنتجات حاليًا.' },
      { status: 500 },
    );
  }
}
