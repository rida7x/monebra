import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * عناصر واجهة صغيرة مشتركة.
 *
 * كلها Server Components — لا تحتاج تفاعلًا، فلا ترسل أي JavaScript
 * إلى المتصفح.
 */

// ────────────────────────────── الشارات ──────────────────────────────

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'glass text-[var(--text-primary)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-contrast)]',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]/15 text-[var(--color-info)]',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold leading-none',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ────────────────────────────── العناوين ──────────────────────────────

export function SectionHeading({
  title,
  subtitle,
  action,
  align = 'start',
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  align?: 'start' | 'center';
}) {
  return (
    <div
      className={cn(
        'mb-8 flex gap-4 sm:mb-10',
        align === 'center'
          ? 'flex-col items-center text-center'
          : 'items-end justify-between',
      )}
    >
      <div className={align === 'center' ? 'flex flex-col items-center' : ''}>
        <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>

        {subtitle ? (
          <p className="mt-2 max-w-lg text-sm text-[var(--text-secondary)]">
            {subtitle}
          </p>
        ) : null}

        <div className="mt-4 h-px w-16 rule-gold" />
      </div>

      {action ? (
        <Link
          href={action.href}
          className="shrink-0 text-sm text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

// ─────────────────────────── الحالات الفارغة ───────────────────────────

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center sm:py-24">
      <div className="mb-1 text-[var(--text-muted)]/40" aria-hidden>
        {icon ?? <span className="font-display text-5xl">M</span>}
      </div>

      <h3 className="text-lg font-semibold">{title}</h3>

      {description ? (
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}

      {action ? (
        <Link
          href={action.href}
          className="tap-target mt-3 inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

// ─────────────────────────── حالة الخطأ ───────────────────────────

export function ErrorState({
  title = 'حدث خطأ غير متوقع',
  description = 'تعذّر تحميل هذا الجزء. حاول مرة أخرى بعد قليل.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger)]/12 text-[var(--color-danger)]"
        aria-hidden
      >
        !
      </div>

      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        {description}
      </p>

      {onRetry}
    </div>
  );
}

// ────────────────────────── هياكل التحميل ──────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

// ─────────────────────────── مقياس من 5 ───────────────────────────

/** شريط بصري للثبات والفوحان */
export function IntensityBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">
        {label}
      </span>

      <div
        className="flex flex-1 gap-1"
        role="img"
        aria-label={`${label}: ${value} من 5`}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              index < value
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--surface-border)]',
            )}
          />
        ))}
      </div>
    </div>
  );
}
