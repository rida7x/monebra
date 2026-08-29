import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * الزر — الأساس البصري لكل إجراء في الموقع.
 *
 * كل المقاسات تحقق حدًا أدنى 44px للمس (إرشادات أبل)، ما عدا `icon-sm`
 * المخصص للأيقونات داخل الجداول في لوحة التحكم حيث الاستخدام بالفأرة.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-glow)]',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--surface-border)] hover:border-[var(--accent)]',
  outline:
    'border border-[var(--surface-border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
  ghost:
    'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-11 px-4 text-sm rounded-full',
  md: 'h-12 px-6 text-sm rounded-full',
  lg: 'h-14 px-8 text-base rounded-full',
  icon: 'h-11 w-11 rounded-full',
  'icon-sm': 'h-9 w-9 rounded-lg',
};

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ' +
  'transition-all duration-300 ease-[var(--ease-luxe)] ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  'active:scale-[0.98]';

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, 'className' | 'children'>;

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </Link>
  );
}
