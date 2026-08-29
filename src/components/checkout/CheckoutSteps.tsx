import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * مؤشّر التقدّم: السلة ← بيانات التوصيل ← تأكيد الطلب.
 *
 * يطمئن العميل إلى قصر المسار قبل أن يبدأ، وهو من أكثر ما يقلّل التخلي عن
 * السلة. المسار كله خطوة واحدة فعليًا — المؤشّر يوضّح موقعه لا أكثر.
 */

const STEPS = ['السلة', 'بيانات التوصيل', 'تأكيد الطلب'] as const;

export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol
      className="mb-10 flex items-center justify-center gap-2 sm:gap-3"
      aria-label="مراحل إتمام الطلب"
    >
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-[var(--color-success)] text-white',
                  active &&
                    'bg-[var(--accent)] text-[var(--accent-contrast)]',
                  !done &&
                    !active &&
                    'border border-[var(--surface-border)] text-[var(--text-muted)]',
                )}
              >
                {done ? <Check size={13} /> : index + 1}
              </span>

              <span
                className={cn(
                  'text-xs sm:text-sm',
                  active
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {label}
              </span>
            </div>

            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'h-px w-4 sm:w-8',
                  done
                    ? 'bg-[var(--color-success)]'
                    : 'bg-[var(--surface-border)]',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
