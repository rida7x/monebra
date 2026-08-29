import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { saveImage } from '@/lib/storage';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

/**
 * رفع صورة.
 *
 * محمي بصلاحية `products.manage`: رفع الملفات أخطر من القراءة، فلا يكفي
 * أن يكون المستخدم مسجّلًا. التحقق من كون الملف صورة حقيقية يتم في
 * `saveImage` عبر sharp — لا نثق بالامتداد ولا بنوع MIME المعلن.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin('products.manage');

    const limit = await rateLimit(
      `upload:${clientIp(request)}`,
      LIMITS.upload().limit,
      LIMITS.upload().windowSeconds,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'رفع كثير في وقت قصير. انتظر قليلًا.' },
        { status: 429 },
      );
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يُرفق أي ملف' }, { status: 400 });
    }

    const result = await saveImage(file);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية رفع الصور' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/upload' });

    return NextResponse.json(
      { error: 'تعذّر رفع الصورة. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}

/** الرفع أبطأ من الطلبات العادية — نمنحه مهلة أطول */
export const maxDuration = 30;
