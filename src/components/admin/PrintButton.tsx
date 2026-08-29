'use client';

import { Printer } from 'lucide-react';

/**
 * زر الطباعة.
 *
 * مكوّن عميل صغير معزول: صفحة الفاتورة كلها Server Component، ولا نريد
 * تحويلها إلى مكوّن عميل لأجل `window.print()` وحدها.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
    >
      <Printer size={15} aria-hidden />
      طباعة الفاتورة
    </button>
  );
}
