import { NextResponse, type NextRequest } from 'next/server';
import { getApprovedReviews } from '@/lib/services/product-detail';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

/**
 * صفحات التقييمات التالية والفلترة بالنجوم.
 *
 * الصفحة الأولى تصل مع صفحة المنتج نفسها (مرسومة على الخادم، فيراها محرك
 * البحث). هذا المسار للصفحات التالية وللفلترة فقط — فلا تُحمَّل مئات
 * التقييمات على زائر يقرأ وصف العطر ولا ينزل إليها أصلًا.
 *
 * قراءة عامة بلا مصادقة: كل ما يعيده منشور أصلًا في صفحة المنتج. لكن يبقى
 * محدود المعدّل لأنه استعلام قاعدة بيانات يمكن استدعاؤه بلا حساب.
 */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);

  try {
    const limit = await rateLimit(`reviews-list:${ip}`, 60, 60);

    if (!limit.allowed) {
      return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
    }

    const params = request.nextUrl.searchParams;
    const productId = params.get('productId');

    if (!productId || productId.length > 64) {
      return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });
    }

    // القيم من الرابط نصوص يكتبها أي أحد — تُقصّ إلى مدى معقول بدل الوثوق
    // بها. `skip` بلا حدّ أعلى يسمح بطلب إزاحة هائلة تُتعب القاعدة.
    const skip = Math.min(
      Math.max(Number.parseInt(params.get('skip') ?? '0', 10) || 0, 0),
      5000,
    );

    const ratingRaw = Number.parseInt(params.get('rating') ?? '', 10);
    const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;

    const page = await getApprovedReviews(productId, { skip, rating });

    return NextResponse.json(page);
  } catch (error) {
    await logError(error, { path: '/api/reviews/list', ip });
    return NextResponse.json({ error: 'تعذّر جلب التقييمات' }, { status: 500 });
  }
}
