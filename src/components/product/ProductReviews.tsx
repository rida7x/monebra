'use client';

import { useState } from 'react';
import { Star, Loader2, MessageSquarePlus, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export type ReviewItem = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

/**
 * تقييمات المنتج وإضافة تقييم جديد.
 *
 * ⚠️ التقييم متاح لمن اشترى المنتج فقط — يتحقق الخادم من ذلك برقم الهاتف.
 * نوضّح هذا الشرط في الواجهة **قبل** أن يكتب العميل، لا بعد أن يُرفض
 * إرساله.
 */
export function ProductReviews({
  productId,
  reviews,
  average,
  count,
}: {
  productId: string;
  reviews: ReviewItem[];
  average: number | null;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section className="mt-16 sm:mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">آراء العملاء</h2>

          {count > 0 && average !== null ? (
            <div className="mt-2 flex items-center gap-2.5">
              <Stars value={Math.round(average)} />
              <span className="tabular text-sm text-[var(--text-secondary)]">
                {average.toFixed(1)} من {count}{' '}
                {count === 1 ? 'تقييم' : 'تقييمًا'}
              </span>
            </div>
          ) : null}

          <div className="mt-4 h-px w-16 rule-gold" />
        </div>

        {!open && !done ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap-target inline-flex items-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-5 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <MessageSquarePlus size={15} aria-hidden />
            أضف تقييمك
          </button>
        ) : null}
      </div>

      {done ? (
        <p
          role="status"
          className="surface-card flex items-center gap-3 p-5 text-sm text-[var(--color-success)]"
        >
          <Check size={18} aria-hidden />
          {done}
        </p>
      ) : null}

      {open ? (
        <ReviewForm
          productId={productId}
          onDone={(message) => {
            setDone(message);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : null}

      {reviews.length === 0 ? (
        <p className="surface-card px-6 py-12 text-center text-sm text-[var(--text-muted)]">
          لا توجد تقييمات بعد. كن أول من يشارك رأيه في هذا العطر.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{review.customerName}</p>
                  <div className="mt-1.5">
                    <Stars value={review.rating} />
                  </div>
                </div>

                <time
                  dateTime={new Date(review.createdAt).toISOString()}
                  className="shrink-0 text-xs text-[var(--text-muted)]"
                >
                  {formatDate(review.createdAt)}
                </time>
              </div>

              {review.comment ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${value} من ٥ نجوم`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={14}
          aria-hidden
          className={cn(
            index <= value
              ? 'fill-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--surface-border-strong)]',
          )}
        />
      ))}
    </span>
  );
}

function ReviewForm({
  productId,
  onDone,
  onCancel,
}: {
  productId: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('اختر عدد النجوم');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating,
          comment: comment.trim() || null,
          customerName: name.trim(),
          phone: phone.trim(),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر إرسال التقييم');
        setSaving(false);
        return;
      }

      onDone(data.message ?? 'شكرًا لك!');
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setSaving(false);
    }
  }

  const inputStyle =
    'h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3.5 text-sm outline-none transition-colors focus:border-[var(--accent)]';

  return (
    <form onSubmit={submit} className="surface-card mb-6 p-5 sm:p-6" noValidate>
      <p className="mb-5 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        التقييم متاح لمن اشترى هذا العطر. نستخدم رقم هاتفك للتحقق من طلبك
        فقط، ولا يظهر للآخرين.
      </p>

      {/* ── النجوم ── */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
          تقييمك
        </legend>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setRating(index)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${index} من ٥ نجوم`}
              aria-pressed={rating === index}
              className="tap-target flex items-center justify-center rounded-lg"
            >
              <Star
                size={26}
                aria-hidden
                className={cn(
                  'transition-colors',
                  index <= (hovered || rating)
                    ? 'fill-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--surface-border-strong)]',
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="reviewName"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            اسمك
          </label>
          <input
            id="reviewName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="reviewPhone"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            رقم الهاتف
          </label>
          <input
            id="reviewPhone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="09XXXXXXXX"
            maxLength={25}
            className={cn(inputStyle, 'tabular text-start')}
          />
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="reviewComment"
          className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
        >
          رأيك في العطر
        </label>
        <textarea
          id="reviewComment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="الثبات، الفوحان، هل نال إعجابك؟"
          className={cn(inputStyle, 'h-auto py-3 leading-relaxed')}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="tap-target inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          إرسال التقييم
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-full border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
