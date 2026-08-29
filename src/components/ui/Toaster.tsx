'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Info, TriangleAlert } from 'lucide-react';
import { useToasts, type ToastTone } from '@/stores/toast';

const ICONS: Record<ToastTone, typeof Check> = {
  success: Check,
  error: TriangleAlert,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  info: 'text-[var(--accent)]',
};

/**
 * حاوية التنبيهات.
 *
 * تظهر أسفل الشاشة على الهاتف (فوق شريط التنقل السفلي) وأعلى اليسار على
 * الشاشات الكبيرة. `aria-live` يجعل قارئ الشاشة ينطق التنبيه دون سرقة
 * التركيز من المستخدم.
 */
export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-24 sm:left-6 sm:right-auto sm:items-start"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon = ICONS[item.tone];

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="glass pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 shadow-[var(--shadow-deep)]"
            >
              <Icon
                size={18}
                className={`shrink-0 ${TONE_CLASS[item.tone]}`}
                aria-hidden
              />

              <p className="flex-1 text-sm text-[var(--text-primary)]">
                {item.message}
              </p>

              {item.action ? (
                <Link
                  href={item.action.href}
                  onClick={() => dismiss(item.id)}
                  className="shrink-0 text-xs font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  {item.action.label}
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="إغلاق التنبيه"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X size={14} aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
