'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Star, Check, EyeOff, Trash2, Loader2, Clock } from 'lucide-react';
import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@/lib/constants';
import { formatDate, formatPhone } from '@/lib/utils';
import { cn } from '@/lib/utils';

type ReviewRow = {
  id: string;
  customerName: string;
  phone: string | null;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: Date;
  verifiedPurchase: boolean;
  product: { id: string; name: string; slug: string };
};

/**
 * مراجعة التقييمات.
 *
 * المدير يوافق أو يخفي أو يحذف — ولا يستطيع تعديل نص التقييم أو نجومه.
 * تعديل كلام العميل يحوّل التقييمات إلى دعاية ويفقدها قيمتها؛ والإخفاء
 * هو الإجراء الصحيح للتقييم المسيء.
 */
export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: ReviewStatus) {
    setBusy(id);
    setError(null);

    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر تحديث التقييم');
        return;
      }

      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('حذف هذا التقييم نهائيًا؟')) return;

    setBusy(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/reviews?id=${id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر الحذف');
        return;
      }

      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  const pending = reviews.filter((review) => review.status === 'pending');

  return (
    <div className="space-y-4">
      {pending.length > 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 p-4 text-sm text-[var(--color-warning)]">
          <Clock size={16} aria-hidden />
          <span className="tabular font-semibold">{pending.length}</span>
          تقييم بانتظار مراجعتك
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <p className="surface-card px-4 py-12 text-center text-sm text-[var(--text-muted)]">
          لا توجد تقييمات بعد
        </p>
      ) : null}

      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="flex items-center gap-0.5"
                    role="img"
                    aria-label={`${review.rating} من ٥`}
                  >
                    {[1, 2, 3, 4, 5].map((index) => (
                      <Star
                        key={index}
                        size={13}
                        aria-hidden
                        className={
                          index <= review.rating
                            ? 'fill-[var(--accent)] text-[var(--accent)]'
                            : 'text-[var(--surface-border-strong)]'
                        }
                      />
                    ))}
                  </span>

                  <StatusChip status={review.status} />
                </div>

                <p className="mt-2 text-sm font-semibold">
                  {review.customerName}
                  {review.phone ? (
                    <span
                      dir="ltr"
                      className="tabular ms-2 text-xs font-normal text-[var(--text-muted)]"
                    >
                      {formatPhone(review.phone)}
                    </span>
                  ) : null}

                  {/* يفرّق للمدير بين رأي مشترٍ ورأي زائر — التقييم مفتوح
                      للجميع، والوسم يُرفع تلقائيًا عند مطابقة طلب */}
                  {review.verifiedPurchase ? (
                    <span className="ms-2 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--accent)]">
                      شراء موثّق
                    </span>
                  ) : null}
                </p>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  <Link
                    href={`/admin/products/${review.product.id}`}
                    className="text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    {review.product.name}
                  </Link>
                  {' · '}
                  {formatDate(review.createdAt, 'datetime')}
                </p>

                {review.comment ? (
                  <p className="mt-3 rounded-lg bg-[var(--surface-sunken)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {review.comment}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {review.status !== 'approved' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(review.id, 'approved')}
                    disabled={busy === review.id}
                    aria-label="نشر التقييم"
                    title="نشر"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-success)]/10 hover:text-[var(--color-success)] disabled:opacity-40"
                  >
                    {busy === review.id ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={15} aria-hidden />
                    )}
                  </button>
                ) : null}

                {review.status !== 'hidden' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(review.id, 'hidden')}
                    disabled={busy === review.id}
                    aria-label="إخفاء التقييم"
                    title="إخفاء"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    <EyeOff size={15} aria-hidden />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(review.id)}
                  disabled={busy === review.id}
                  aria-label="حذف التقييم"
                  title="حذف"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-40"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tones: Record<string, string> = {
    pending: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
    approved: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    hidden: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[0.65rem] font-semibold',
        tones[status],
      )}
    >
      {REVIEW_STATUS_LABELS[status as ReviewStatus] ?? status}
    </span>
  );
}
