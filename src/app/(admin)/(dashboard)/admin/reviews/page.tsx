import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@/generated/prisma/client';
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

/** قيمة مفردة من الرابط — المعامل قد يتكرر فيصل مصفوفة */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  await requirePageAccess('reviews.manage');

  const params = await searchParams;

  const statusParam = one(params.status);
  const status = REVIEW_STATUSES.includes(statusParam as never)
    ? statusParam
    : undefined;

  const ratingRaw = Number.parseInt(one(params.rating) ?? '', 10);
  const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined;

  const productId = one(params.product) || undefined;
  const query = (one(params.q) ?? '').trim().slice(0, 80);

  /**
   * الفلاتر تُبنى مرة وتُستخدم في الاستعلامين معًا.
   *
   * ⚠️ البحث `contains` بلا `mode: 'insensitive'` حساس لحالة الأحرف على
   * PostgreSQL. العربية بلا حالة أصلًا فالفرق يظهر في أسماء المنتجات
   * اللاتينية وحدها — ومعها يصير البحث عن "monebra" لا يجد "Monebra".
   */
  const where: Prisma.ReviewWhereInput = {
    ...(status ? { status } : {}),
    ...(rating ? { rating } : {}),
    ...(productId ? { productId } : {}),
    ...(query
      ? {
          OR: [
            { customerName: { contains: query, mode: 'insensitive' } },
            { comment: { contains: query, mode: 'insensitive' } },
            { product: { name: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [reviews, byStatusRows, byRatingRows, totals, products] =
    await Promise.all([
      prisma.review.findMany({
        where,
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
          verifiedPurchase: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      }),

      // العدّادات على كل التقييمات لا على المفلترة: رقم يتغيّر مع الفلتر
      // لا يصلح شارةً على زرّ الفلتر نفسه
      prisma.review.groupBy({ by: ['status'], _count: true }),
      prisma.review.groupBy({ by: ['rating'], _count: true }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: true }),

      prisma.product.findMany({
        where: { reviews: { some: {} } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) byStatus[row.status] = row._count;

  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of byRatingRows) byRating[row.rating] = row._count;

  const total = totals._count;
  const average = totals._avg.rating;

  const filtered = Boolean(status || rating || productId || query);

  return (
    <div className="space-y-5">
      {/* ── إحصائيات ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي التقييمات" value={String(total)} />
        <Stat
          label="متوسط التقييم"
          value={average !== null ? `${average.toFixed(2)} / 5` : '—'}
        />
        <Stat
          label="بانتظار المراجعة"
          value={String(byStatus.pending ?? 0)}
          highlight={(byStatus.pending ?? 0) > 0}
        />
        <Stat label="منشورة" value={String(byStatus.approved ?? 0)} />
      </div>

      <div className="surface-card p-4">
        <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">
          التوزيع حسب النجوم
        </p>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((star) => (
            <FilterLink
              key={star}
              href={buildHref(params, { rating: rating === star ? null : star })}
              active={rating === star}
            >
              {star} ★ ({byRating[star] ?? 0})
            </FilterLink>
          ))}
        </div>
      </div>

      {/* ── الحالة ── */}
      <nav aria-label="تصفية حسب الحالة" className="flex flex-wrap gap-2">
        <FilterLink href={buildHref(params, { status: null })} active={!status}>
          كل الحالات ({total})
        </FilterLink>

        {REVIEW_STATUSES.map((value) => (
          <FilterLink
            key={value}
            href={buildHref(params, { status: value })}
            active={status === value}
          >
            {REVIEW_STATUS_LABELS[value]} ({byStatus[value] ?? 0})
          </FilterLink>
        ))}
      </nav>

      {/* ── بحث ومنتج ──
          نموذج GET عادي: يعمل بلا جافاسكربت، ويُبقي الفلاتر في الرابط
          فيمكن حفظه ومشاركته. */}
      <form method="get" className="surface-card flex flex-wrap gap-3 p-4">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {rating ? <input type="hidden" name="rating" value={rating} /> : null}

        <input
          name="q"
          defaultValue={query}
          placeholder="ابحث في الاسم أو التعليق أو المنتج"
          maxLength={80}
          className="min-w-[12rem] flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />

        <select
          name="product"
          defaultValue={productId ?? ''}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">كل المنتجات</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-contrast)]"
        >
          تصفية
        </button>

        {filtered ? (
          <Link
            href="/admin/reviews"
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            مسح
          </Link>
        ) : null}
      </form>

      {reviews.length === 0 ? (
        <p className="surface-card p-8 text-center text-sm text-[var(--text-muted)]">
          {filtered ? 'لا تقييمات تطابق هذه الفلاتر.' : 'لا توجد تقييمات بعد.'}
        </p>
      ) : (
        <>
          <ReviewsManager reviews={reviews} />

          {reviews.length === 100 ? (
            <p className="text-center text-xs text-[var(--text-muted)]">
              تُعرض أحدث ١٠٠ تقييم. ضيّق الفلاتر للوصول إلى الأقدم.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** يبني رابطًا يحافظ على بقية الفلاتر ويغيّر واحدًا */
function buildHref(
  params: Record<string, string | string[] | undefined>,
  change: Record<string, string | number | null>,
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) next.set(key, single);
  }

  for (const [key, value] of Object.entries(change)) {
    if (value === null) next.delete(key);
    else next.set(key, String(value));
  }

  const query = next.toString();
  return query ? `/admin/reviews?${query}` : '/admin/reviews';
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          'tabular mt-1 text-2xl font-semibold',
          highlight ? 'text-[var(--accent)]' : '',
        )}
      >
        {value}
      </p>
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
