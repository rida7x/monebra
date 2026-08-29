'use client';

import { useEffect } from 'react';
import { RotateCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * حدود الخطأ لواجهة المتجر.
 *
 * لا نعرض للعميل رسالة الخطأ التقنية ولا الـ Stack Trace — فقط جملة
 * مفهومة وطريقتان للخروج من المأزق. التفاصيل تُسجَّل على الخادم.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
  }, [error]);

  return (
    <main className="container-page flex min-h-[60svh] flex-col items-center justify-center py-16 text-center">
      <span className="font-display text-6xl text-[var(--text-muted)]/25" aria-hidden>
        M
      </span>

      <h1 className="mt-6 text-2xl font-semibold">حدث خطأ غير متوقع</h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        تعذّر عرض هذه الصفحة. حاول مرة أخرى، وإن استمرت المشكلة تواصل معنا.
      </p>

      {error.digest ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          رمز الخطأ: <span className="tabular">{error.digest}</span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="tap-target inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <RotateCw size={15} aria-hidden />
          إعادة المحاولة
        </button>

        <Link
          href="/"
          className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-8 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Home size={15} aria-hidden />
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
