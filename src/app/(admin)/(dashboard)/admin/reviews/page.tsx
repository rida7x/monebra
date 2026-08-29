import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ReviewsManager } from '@/components/admin/ReviewsManager';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'التقييمات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  await requirePageAccess('reviews.manage');

  const params = await searchParams;
  const raw = params.status;
  const statusParam = Array.isArray(raw) ? raw[0] : raw;
  const status = REVIEW_STATUSES.includes(statusParam as never)
    ? statusParam
    : undefined;

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        customerName: true,
        phone: true,
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.review.groupBy({ by: ['status'], _count: true }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row.status] = row._count;

  return (
    <div className="space-y-5">
      <nav aria-label="تصفية التقييمات" className="flex flex-wrap gap-2">
        <FilterLink href="/admin/reviews" active={!status}>
          الكل ({Object.values(byStatus).reduce((a, b) => a + b, 0)})
        </FilterLink>

        {REVIEW_STATUSES.map((value) => (
          <FilterLink
            key={value}
            href={`/admin/reviews?status=${value}`}
            active={status === value}
          >
            {REVIEW_STATUS_LABELS[value]} ({byStatus[value] ?? 0})
          </FilterLink>
        ))}
      </nav>

      <ReviewsManager reviews={reviews} />
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-4 py-2 text-xs transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]',
      )}
    >
      {children}
    </Link>
  );
}
