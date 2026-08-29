import { NextResponse, type NextRequest } from 'next/server';

/**
 * حارس المسارات الإدارية.
 *
 * ⚠️ هذه بوابة **رخيصة** فقط: تتحقق من وجود كوكي الجلسة لا من صحتها.
 * التحقق الحقيقي — صلاحية الرمز، انتهاء الجلسة، تفعيل الحساب، الصلاحيات —
 * يتم في `requireAdmin()` داخل كل صفحة وكل نقطة نهاية إدارية.
 *
 * سبب الفصل: `proxy` يعمل على كل طلب، ووضع استعلام قاعدة بيانات فيه يضاعف
 * زمن الاستجابة بلا فائدة أمنية — لأن أي طبقة بعده تتحقق على أي حال.
 *
 * ملاحظة Next 16: الملف كان اسمه middleware.ts، وأصبح proxy.ts بدالة
 * مُصدَّرة باسم `proxy` تعمل على بيئة Node.
 */

const SESSION_COOKIE = 'monebra_admin_session';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ── ترميز فاسد في المسار ──
  // مثل /product/%zz — لا يستطيع Next فكّه فيرمي خطأً غير ملتقَط ويعيد 500.
  // الرد الصحيح 404: المورد غير موجود، لا عطل في الخادم. بدون هذا الفحص
  // يستطيع أي فاحص آلي ملء سجل الأخطاء بمئات الإدخالات الوهمية.
  if (!isDecodable(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const isLoginPage = pathname === '/admin/login';
  const isAuthApi = pathname.startsWith('/api/admin/auth/');
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // نقاط نهاية المصادقة مفتوحة — بها حظر تخمين خاص
  if (isAuthApi) return NextResponse.next();

  // جلسة فاسدة: الصفحة تحقّقت من القاعدة ووجدتها غير صالحة، فأرسلتنا هنا
  // بعلامة `expired`. نحذف الكوكي ونعرض صفحة الدخول — بدون هذا يعيدنا
  // الشرط التالي إلى اللوحة فتنشأ حلقة تحويل لا نهائية.
  if (isLoginPage && request.nextUrl.searchParams.has('expired')) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // مسجّل دخول ويفتح صفحة الدخول ⇒ إلى اللوحة
  if (isLoginPage && hasSession) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (isLoginPage) return NextResponse.next();

  // ── واجهات برمجية إدارية: نعيد 401 لا تحويلًا ──
  if (pathname.startsWith('/api/admin')) {
    if (!hasSession) {
      return NextResponse.json(
        { error: 'انتهت الجلسة. سجّل الدخول مرة أخرى.' },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // ── صفحات اللوحة ──
  if (pathname.startsWith('/admin')) {
    if (!hasSession) {
      const loginUrl = new URL('/admin/login', request.url);
      // نحفظ الوجهة ليعود إليها بعد الدخول
      loginUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

/** هل يمكن فكّ ترميز المسار بأمان؟ */
function isDecodable(pathname: string): boolean {
  if (!pathname.includes('%')) return true;

  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  /**
   * كل المسارات ما عدا أصول Next الثابتة والصور — فحص الترميز يجب أن
   * يشمل كل مسار ديناميكي، لا مسارات اللوحة وحدها.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|uploads/|sw.js).*)',
  ],
};
