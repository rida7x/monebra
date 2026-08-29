import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff, RotateCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'لا يوجد اتصال',
  robots: { index: false, follow: false },
};

/**
 * صفحة انقطاع الاتصال.
 *
 * يعرضها Service Worker عندما يفشل الطلب ولا توجد نسخة مخزّنة. صفحة
 * مصمّمة أفضل بكثير من شاشة خطأ المتصفح، وتُطمئن العميل أن المتجر يعمل
 * وأن المشكلة في اتصاله.
 *
 * ثابتة تمامًا: لا تقرأ قاعدة البيانات، وإلا استحال تخزينها مسبقًا.
 */
export default function OfflinePage() {
  return (
    <main className="container-page flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-sunken)]"
        aria-hidden
      >
        <WifiOff size={28} className="text-[var(--text-muted)]" />
      </div>

      <h1 className="text-2xl font-semibold">لا يوجد اتصال بالإنترنت</h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        تحقّق من اتصالك ثم أعد المحاولة. الصفحات التي زرتها من قبل تبقى
        متاحة للتصفّح.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="tap-target inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <RotateCw size={15} aria-hidden />
          إعادة المحاولة
        </Link>
      </div>
    </main>
  );
}
