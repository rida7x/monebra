import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * عناصر لوحة التحكم المشتركة.
 *
 * كلها Server Components — الجداول والبطاقات لا تحتاج تفاعلًا، فلا نرسل
 * أي JavaScript إلى المتصفح لأجلها.
 */

// ─────────────────────────── بطاقة إحصائية ───────────────────────────

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  href?: string;
}) {
  const tones = {
    neutral: 'text-[var(--text-primary)]',
    accent: 'text-[var(--accent)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
        {icon ? (
          <span className={cn('shrink-0 opacity-70', tones[tone])} aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>

      <p className={cn('tabular mt-3 text-2xl font-bold', tones[tone])}>
        {value}
      </p>

      {hint ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </>
  );

  const className =
    'surface-card block p-4 transition-colors sm:p-5';

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, 'hover:border-[var(--accent)]')}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

// ─────────────────────────── شارة الحالة ───────────────────────────

const TONE_CLASS: Record<string, string> = {
  info: 'bg-[var(--color-info)]/12 text-[var(--color-info)]',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  danger: 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
};

export function StatusBadge({ status }: { status: string }) {
  const known = status as OrderStatus;
  const label = ORDER_STATUS_LABELS[known] ?? status;
  const tone = ORDER_STATUS_TONE[known] ?? 'info';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold leading-none',
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

// ─────────────────────────── الجداول ───────────────────────────

/**
 * غلاف الجدول.
 *
 * `overflow-x-auto` على الحاوية وحدها — لا على الصفحة — فالجدول العريض
 * يمرّر داخل نفسه ولا يسبب تمريرًا أفقيًا للصفحة كلها على الهاتف.
 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[42rem] text-sm">{children}</table>;
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-[var(--surface-border)] px-4 py-3 text-start text-xs font-semibold text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  title,
  dir,
}: {
  children?: React.ReactNode;
  className?: string;
  /** تلميح عند التحويم — مفيد لعرض التاريخ الكامل خلف «منذ ساعة» */
  title?: string;
  /** لعرض المسارات والبُرد بالإنجليزية داخل صفحة عربية */
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <td
      title={title}
      dir={dir}
      className={cn(
        'border-b border-[var(--surface-border)] px-4 py-3 align-middle',
        className,
      )}
    >
      {children}
    </td>
  );
}

// ─────────────────────────── عناوين الأقسام ───────────────────────────

export function PanelHeading({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action ? (
        <Link
          href={action.href}
          className="text-xs text-[var(--accent)] underline-offset-4 hover:underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** حالة فارغة داخل بطاقة أو جدول */
export function PanelEmpty({ message }: { message: string }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
      {message}
    </p>
  );
}

// ─────────────────────────── تنسيق المال ───────────────────────────

export type Currency = { symbol: string; decimals: number };

export function formatCurrency(minor: number, currency: Currency): string {
  return formatMoney(minor, {
    currency: currency.symbol,
    decimals: currency.decimals,
  });
}
