import Link from 'next/link';
import { Home, LayoutGrid } from 'lucide-react';

export default function StorefrontNotFound() {
  return (
    <main className="container-page flex min-h-[60svh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-7xl text-gold-gradient">404</p>

      <h1 className="mt-4 text-2xl font-semibold">الصفحة غير موجودة</h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        ربما حُذف هذا العطر أو تغيّر رابطه. تصفّح مجموعتنا الكاملة لتجد ما
        يناسبك.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/products"
          className="tap-target inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <LayoutGrid size={15} aria-hidden />
          تصفّح العطور
        </Link>

        <Link
          href="/"
          className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-8 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Home size={15} aria-hidden />
          الرئيسية
        </Link>
      </div>
    </main>
  );
}
