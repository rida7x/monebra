'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, Loader2, X, BadgeCheck, PenLine } from 'lucide-react';
import { timeAgo, cn } from '@/lib/utils';

export type ReviewItem = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: Date | string;
  verifiedPurchase: boolean;
  helpfulCount: number;
};

/** وصف كل درجة — يطمئن العميل أن ضغطته سُجّلت كما قصد */
const RATING_LABELS: Record<number, string> = {
  1: 'سيئ جدًا',
  2: 'سيئ',
  3: 'جيد',
  4: 'جيد جدًا',
  5: 'ممتاز',
};

/**
 * تقييمات المنتج.
 *
 * الهدف: من فتح القسم إلى إرسال الرأي في عشر ثوانٍ — نجوم، ثم إرسال.
 * الاسم والتعليق اختياريان، ولا حساب ولا تسجيل دخول.
 *
 * ⚠️ لا حماية هنا. المصيدة أدناه راحة للخادم لا حاجز: الروبوت يرسل إلى
 * `/api/reviews` مباشرة ولا يمرّ بهذا الملف أصلًا. الحدّ والتكرار والتحقق
 * كلها على الخادم.
 */
export function ProductReviews({
  productId,
  initialReviews,
  initialHasMore,
  breakdown,
  average,
  count,
}: {
  productId: string;
  initialReviews: ReviewItem[];
  initialHasMore: boolean;
  breakdown: Record<number, number>;
  average: number | null;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState(initialReviews);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filter, setFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /** يمنع سباق النتائج: ردّ فلتر قديم يصل بعد الجديد فيدهسه */
  const requestRef = useRef(0);

  async function load(nextFilter: number | null, skip: number) {
    const ticket = ++requestRef.current;
    setLoading(true);

    try {
      const query = new URLSearchParams({ productId, skip: String(skip) });
      if (nextFilter) query.set('rating', String(nextFilter));

      const response = await fetch(`/api/reviews/list?${query}`);
      const data = (await response.json()) as {
        reviews?: ReviewItem[];
        hasMore?: boolean;
      };

      if (ticket !== requestRef.current) return;

      setReviews((current) =>
        skip === 0 ? (data.reviews ?? []) : [...current, ...(data.reviews ?? [])],
      );
      setHasMore(Boolean(data.hasMore));
    } catch {
      if (ticket === requestRef.current) setHasMore(false);
    } finally {
      if (ticket === requestRef.current) setLoading(false);
    }
  }

  function changeFilter(next: number | null) {
    setFilter(next);
    if (next === null && reviews === initialReviews) return;
    void load(next, 0);
  }

  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

  return (
    <section className="mt-16 sm:mt-24">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          آراء وتقييمات العملاء
        </h2>
        <div className="mt-4 h-px w-16 rule-gold" />
      </div>

      {count > 0 && average !== null ? (
        <div className="surface-card grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-12">
          {/* ── المتوسط ── */}
          <div className="text-center md:text-start">
            <div className="tabular font-display text-5xl leading-none text-[var(--accent)] sm:text-6xl">
              {average.toFixed(1)}
            </div>
            <div className="mt-3 flex justify-center md:justify-start">
              <Stars value={Math.round(average)} size={18} />
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              من ٥ · {count} {count === 1 ? 'تقييم' : 'تقييمًا'}
            </p>
          </div>

          {/* ── توزيع النجوم ── */}
          <div className="flex flex-col justify-center gap-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const value = breakdown[star] ?? 0;
              const percent = total > 0 ? (value / total) * 100 : 0;

              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => changeFilter(filter === star ? null : star)}
                  aria-pressed={filter === star}
                  aria-label={`عرض تقييمات ${star} نجوم (${value})`}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-1 py-0.5 text-start transition-colors',
                    filter === star
                      ? 'bg-[var(--surface-sunken)]'
                      : 'hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  <span className="tabular flex w-8 shrink-0 items-center gap-0.5 text-xs text-[var(--text-secondary)]">
                    {star}
                    <Star size={11} className="fill-current" aria-hidden />
                  </span>

                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-[var(--ease-luxe)]"
                      style={{ width: `${percent}%` }}
                    />
                  </span>

                  <span className="tabular w-8 shrink-0 text-end text-xs text-[var(--text-muted)]">
                    {value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── زر التقييم ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {count === 0 ? (
          <p className="text-[var(--text-secondary)]">
            كن أول من يقيّم هذا العطر ⭐
          </p>
        ) : filter ? (
          <button
            type="button"
            onClick={() => changeFilter(null)}
            className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
          >
            عرض كل التقييمات
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-target inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
        >
          <PenLine size={15} aria-hidden />
          {count === 0 ? 'أضف تقييمك' : 'قيّم المنتج'}
        </button>
      </div>

      {done ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-[var(--accent)]/40 bg-[var(--surface-sunken)] p-4 text-sm text-[var(--text-primary)]"
        >
          {done}
        </p>
      ) : null}

      {/* ── القائمة ── */}
      {reviews.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <Stars value={review.rating} size={14} />
                <time
                  className="shrink-0 text-xs text-[var(--text-muted)]"
                  dateTime={new Date(review.createdAt).toISOString()}
                >
                  {timeAgo(review.createdAt)}
                </time>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
                {review.customerName}
                {review.verifiedPurchase ? (
                  <span
                    title="شراء موثّق"
                    className="inline-flex items-center gap-1 text-xs font-normal text-[var(--accent)]"
                  >
                    <BadgeCheck size={13} aria-hidden />
                    شراء موثّق
                  </span>
                ) : null}
              </p>

              {review.comment ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : filter ? (
        <p className="mt-8 text-sm text-[var(--text-muted)]">
          لا توجد تقييمات بـ {filter} نجوم.
        </p>
      ) : null}

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(filter, reviews.length)}
            className="tap-target inline-flex items-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-6 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : null}
            عرض المزيد
          </button>
        </div>
      ) : null}

      <ReviewSheet
        productId={productId}
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={(message) => {
          setDone(message);
          setOpen(false);
        }}
      />
    </section>
  );
}

/**
 * نموذج التقييم — ورقة سفلية على الهاتف، ونافذة في الوسط على الشاشات الكبيرة.
 *
 * لماذا ورقة سفلية: الإبهام يصل إلى أسفل الشاشة، ونافذة في الوسط تدفع لوحة
 * المفاتيح فوقها فتغطّي زر الإرسال.
 */
function ReviewSheet({
  productId,
  open,
  onClose,
  onSuccess,
}: {
  productId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // المصيدة
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // قفل تمرير الخلفية — بدونه تتحرّك الصفحة تحت الورقة على الهاتف
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return; // يمنع الإرسال المزدوج على الضغط المتكرر

    if (rating < 1) {
      setError('اختر عدد النجوم أولًا');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating,
          customerName: name.trim() || null,
          comment: comment.trim() || null,
          website,
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'تعذّر إرسال التقييم، حاول مرة أخرى.');
        return;
      }

      onSuccess(data.message ?? 'شكرًا لك ❤️ تم إرسال تقييمك.');
      setRating(0);
      setName('');
      setComment('');
    } catch {
      setError('تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  }

  const shown = hover || rating;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="تقييم المنتج"
        >
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
          />

          <motion.form
            onSubmit={submit}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-t-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-deep)] sm:rounded-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">قيّم هذا العطر</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="tap-target -me-2 flex items-center justify-center rounded-full text-[var(--text-secondary)]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* ── النجوم ── */}
            <div
              className="flex justify-center gap-1.5"
              onMouseLeave={() => setHover(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  aria-label={`${star} من ٥ — ${RATING_LABELS[star]}`}
                  aria-pressed={rating === star}
                  className="rounded-full p-1 transition-transform duration-200 hover:scale-110 active:scale-95"
                >
                  <Star
                    size={38}
                    aria-hidden
                    className={cn(
                      'transition-colors duration-200',
                      star <= shown
                        ? 'fill-[var(--accent)] text-[var(--accent)]'
                        : 'fill-transparent text-[var(--surface-border-strong)]',
                    )}
                  />
                </button>
              ))}
            </div>

            {/* الارتفاع ثابت كي لا تقفز الحقول عند ظهور الوصف */}
            <p className="mt-2 h-5 text-center text-sm text-[var(--accent)]">
              {shown ? RATING_LABELS[shown] : ''}
            </p>

            <div className="mt-5 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="اسمك (اختياري)"
                // 16px حدًّا أدنى: أي أصغر يجعل iOS يقرّب الصفحة عند التركيز
                className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-4 py-3 text-base outline-none transition-colors focus:border-[var(--accent)]"
              />

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="اكتب رأيك عن المنتج... (اختياري)"
                className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-4 py-3 text-base outline-none transition-colors focus:border-[var(--accent)]"
              />

              {/* ── المصيدة ──
                  خارج الشاشة لا `display:none`: بعض الروبوتات تتخطّى المخفي
                  بالكامل. و`tabIndex={-1}` و`aria-hidden` يمنعان وصول لوحة
                  المفاتيح وقارئ الشاشة إليه. */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
            </div>

            {error ? (
              <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={sending}
              className="tap-target mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : null}
              {sending ? 'جارٍ الإرسال…' : 'إرسال التقييم'}
            </button>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex gap-0.5 text-[var(--accent)]"
      role="img"
      aria-label={`${value} من ٥ نجوم`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          aria-hidden
          className={star <= value ? 'fill-current' : 'fill-transparent opacity-30'}
        />
      ))}
    </span>
  );
}
