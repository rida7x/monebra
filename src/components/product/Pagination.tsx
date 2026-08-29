import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ترقيم الصفحات — روابط حقيقية (`<a>`) لا أزرار.
 *
 * هذا مقصود: محركات البحث تزحف إلى كل الصفحات، ويستطيع العميل فتح صفحة في
 * تبويب جديد. في RTL يشير سهم «التالي» إلى اليسار.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);

  return (
    <nav
      aria-label="صفحات النتائج"
      className="mt-12 flex items-center justify-center gap-1.5"
    >
      <PageArrow
        href={page > 1 ? buildHref(page - 1) : null}
        label="الصفحة السابقة"
      >
        <ChevronRight size={16} aria-hidden />
      </PageArrow>

      {pages.map((entry, index) =>
        entry === null ? (
          <span
            key={`gap-${index}`}
            className="px-1 text-sm text-[var(--text-muted)]"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            aria-current={entry === page ? 'page' : undefined}
            aria-label={`الصفحة ${entry}`}
            className={cn(
              'tabular flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm transition-all duration-300',
              entry === page
                ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-contrast)]'
                : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <PageArrow
        href={page < totalPages ? buildHref(page + 1) : null}
        label="الصفحة التالية"
      >
        <ChevronLeft size={16} aria-hidden />
      </PageArrow>
    </nav>
  );
}

function PageArrow({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    'tap-target flex items-center justify-center rounded-full border border-[var(--surface-border)] transition-all duration-300';

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(className, 'opacity-35')}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        className,
        'text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * نافذة أرقام حول الصفحة الحالية: 1 … 4 [5] 6 … 20
 * `null` = فجوة. يبقي الشريط قصيرًا مهما كثرت الصفحات.
 */
function pageWindow(page: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const result: (number | null)[] = [1];

  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) result.push(null);
  for (let index = start; index <= end; index += 1) result.push(index);
  if (end < total - 1) result.push(null);

  result.push(total);
  return result;
}
