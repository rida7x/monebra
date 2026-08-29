'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * تتبّع الزيارات — داخلي بالكامل.
 *
 * لا Google Analytics ولا أي خدمة خارجية: بيانات عملاء المتجر لا تغادر
 * الخادم. ما نقيسه هو ما يحتاجه صاحب المتجر فعلًا — أي المنتجات تُشاهَد،
 * وأيها يُضاف للسلة، وكم يصل إلى الدفع.
 *
 * `sessionStorage` لا `localStorage`: المعرّف ينتهي بإغلاق التبويب، فلا
 * يمكن تتبّع الزائر عبر الزيارات. يكفي لحساب معدّل التحويل داخل الجلسة.
 *
 * `sendBeacon` عند توفّره: يضمن وصول الحدث حتى لو غادر المستخدم الصفحة
 * فورًا، ولا يؤخّر التنقّل.
 */

const SESSION_KEY = 'monebra-session';

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // وضع التصفّح الخاص قد يمنع التخزين — نكتفي بحدث بلا معرّف
    return '';
  }
}

export function track(
  type: 'page_view' | 'product_view' | 'add_to_cart' | 'begin_checkout',
  data: { productId?: string; path?: string } = {},
): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    type,
    sessionId: sessionId(),
    path: data.path ?? window.location.pathname,
    productId: data.productId,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics',
        new Blob([payload], { type: 'application/json' }),
      );
      return;
    }

    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch {
    // التحليلات لا تُفشل شيئًا
  }
}

/** يسجّل مشاهدة صفحة عند كل تنقّل */
export function PageTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // التنقّل داخل التطبيق قد يعيد تشغيل التأثير بنفس المسار — نتجاهله
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    // لا نتتبّع لوحة التحكم — إحصائيات المتجر تخصّ الزوار لا الموظفين
    if (pathname.startsWith('/admin')) return;

    track('page_view', { path: pathname });
  }, [pathname]);

  return null;
}
