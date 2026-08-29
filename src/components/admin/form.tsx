'use client';

import { cn } from '@/lib/utils';

/**
 * حقول النماذج المشتركة في لوحة التحكم.
 *
 * كل حقل يربط `label` بـ `id` ويعرض الخطأ عبر `role="alert"` — فقارئ
 * الشاشة ينطق الخطأ فور ظهوره، والنقر على التسمية ينقل التركيز للحقل.
 */

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
      >
        {label}
        {required ? (
          <span className="text-[var(--color-danger)]" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>

      {children}

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]';

export const textareaClass = `${inputClass} h-auto py-2.5 leading-relaxed`;

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 items-center rounded-full border px-4 text-xs transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]',
      )}
    >
      {label}
    </button>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
