import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { login, pruneExpiredSessions } from '@/lib/auth';
import { rateLimit, clientIp, LIMITS } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

/**
 * تسجيل دخول المدير.
 *
 * ثلاث طبقات ضد التخمين:
 *  1. تحديد معدّل بالـ IP هنا
 *  2. عدّ المحاولات الفاشلة بالبريد وبالـ IP في `login()`
 *  3. تجزئة وهمية تُساوي زمن الاستجابة بين البريد الموجود وغير الموجود
 *
 * الرسالة موحّدة دائمًا: «البريد أو كلمة المرور غير صحيحة» — لا نكشف
 * أي الحقلين كان خاطئًا ولا أي البُرد مسجّل.
 */

const LoginSchema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صالح').max(200),
  password: z.string().min(1, 'أدخل كلمة المرور').max(200),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  try {
    const limit = await rateLimit(
      `login:${ip}`,
      LIMITS.login().limit,
      LIMITS.login().windowSeconds,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير مكتملة' },
        { status: 400 },
      );
    }

    const result = await login(parsed.data.email, parsed.data.password, {
      ip,
      userAgent: request.headers.get('user-agent'),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        {
          status: result.retryAfterSeconds ? 429 : 401,
          headers: result.retryAfterSeconds
            ? { 'Retry-After': String(result.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    // تنظيف الجلسات المنتهية — لحظة مناسبة لأنها نادرة نسبيًا
    void pruneExpiredSessions();

    return NextResponse.json({
      ok: true,
      user: {
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    await logError(error, { path: '/api/admin/auth/login', ip });

    return NextResponse.json(
      { error: 'تعذّر تسجيل الدخول حاليًا. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
