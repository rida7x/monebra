'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Loader2, CornerDownLeft } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { MAX_QUERY_LENGTH } from '@/lib/search';

type SearchHit = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  inspirationName: string | null;
  variantCount: number;
  outOfStock: boolean;
};

type SearchResponse = {
  query: string;
  results: SearchHit[];
  currency: { symbol: string; decimals: number };
};

const DEBOUNCE_MS = 220;

/**
 * طبقة البحث الفوري.
 *
 * تفاصيل مقصودة:
 *  • تأخير 220ms قبل الطلب — يقلل الطلبات إلى الثلث تقريبًا أثناء الكتابة
 *  • إلغاء الطلب السابق عبر AbortController — يمنع وصول نتيجة قديمة بعد
 *    الجديدة وعرضها خطأً (سباق شائع في البحث الفوري)
 *  • Escape يغلق، Enter ينتقل لصفحة النتائج الكاملة
 *  • حبس التمرير خلف الطبقة حتى لا تتحرك الصفحة تحت الإصبع
 */
export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const trimmed = query.trim();
  const tooShort = trimmed.length < 2;

  // «قيد التحميل» و«فشل» مشتقّان من مقارنة الاستعلام الحالي بما وصل من
  // الخادم — لا نزامنهما بـ setState داخل useEffect. النتيجة: لا رسم
  // مضاعف، ولا احتمال بقاء مؤشر تحميل عالقًا بعد استجابة متأخرة.
  const isStale = !tooShort && data?.query !== trimmed;
  const loading = isStale && failed !== trimmed;

  const reset = useCallback(() => {
    setQuery('');
    setData(null);
    setFailed(null);
  }, []);

  // تركيز الحقل عند الفتح + حبس تمرير الصفحة
  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // إغلاق بمفتاح Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // البحث مع تأخير وإلغاء الطلب السابق
  useEffect(() => {
    if (!open || tooShort) return;
    if (data?.query === trimmed || failed === trimmed) return;

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error('search failed');

        const payload = (await response.json()) as SearchResponse;
        // الخادم يعيد الاستعلام الذي عالجه، فنثبّته في الحالة ونتجاهل
        // أي استجابة تخصّ استعلامًا قديمًا
        setData({ ...payload, query: trimmed });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setFailed(trimmed);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [trimmed, tooShort, open, data?.query, failed]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort) return;

    onClose();
    reset();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleClose() {
    onClose();
    reset();
  }

  const fresh = !tooShort && data?.query === trimmed;
  const hits = fresh ? data.results : [];
  const showEmpty = fresh && hits.length === 0;
  const showError = failed === trimmed;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label="البحث في المتجر"
        >
          <button
            type="button"
            aria-label="إغلاق البحث"
            onClick={handleClose}
            className="absolute inset-0 h-full w-full cursor-default bg-[var(--surface-base)]/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-[8vh] w-full max-w-2xl px-4"
          >
            <form onSubmit={submit} className="relative">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />

              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="ابحث عن عطر، أو اكتب اسم عطر عالمي…"
                aria-label="ابحث عن عطر"
                autoComplete="off"
                className="glass h-14 w-full rounded-2xl ps-12 pe-12 text-base text-[var(--text-primary)] shadow-[var(--shadow-deep)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />

              <button
                type="button"
                onClick={handleClose}
                aria-label="إغلاق"
                className="tap-target absolute end-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <X size={18} aria-hidden />
                )}
              </button>
            </form>

            {/* ── النتائج ── */}
            <div
              className="mt-3 max-h-[60vh] overflow-y-auto"
              aria-live="polite"
              aria-busy={loading}
            >
              {fresh && hits.length > 0 && data ? (
                <div className="glass overflow-hidden rounded-2xl shadow-[var(--shadow-deep)]">
                  {hits.map((hit) => (
                    <Link
                      key={hit.id}
                      href={`/product/${hit.slug}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 border-b border-[var(--surface-border)] p-3 transition-colors last:border-b-0 hover:bg-[var(--surface-sunken)]"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                        {hit.image ? (
                          <Image
                            src={hit.image}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-full w-full items-center justify-center font-display text-xl text-[var(--text-muted)]/30"
                            aria-hidden
                          >
                            M
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {hit.name}
                        </p>
                        {hit.inspirationName ? (
                          <p className="truncate text-xs text-[var(--text-muted)]">
                            مستوحى من {hit.inspirationName}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-end">
                        <p className="tabular text-sm font-semibold text-[var(--accent)]">
                          {hit.variantCount > 1 ? 'من ' : ''}
                          {formatMoney(hit.price, {
                            currency: data.currency.symbol,
                            decimals: data.currency.decimals,
                          })}
                        </p>
                        {hit.outOfStock ? (
                          <p className="text-[0.65rem] text-[var(--text-muted)]">
                            غير متوفر
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}

                  <button
                    type="button"
                    onClick={submit}
                    className="flex w-full items-center justify-center gap-2 bg-[var(--surface-sunken)] p-3.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--surface-raised)]"
                  >
                    عرض كل النتائج
                    <CornerDownLeft size={13} aria-hidden />
                  </button>
                </div>
              ) : null}

              {showEmpty ? (
                <div className="glass rounded-2xl p-8 text-center shadow-[var(--shadow-deep)]">
                  <p className="text-sm font-semibold">لم نجد ما تبحث عنه</p>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    جرّب كلمة أقصر، أو اسم العطر العالمي المستوحى منه.
                  </p>
                  <button
                    type="button"
                    onClick={submit}
                    className="mt-4 text-xs font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    عرض اقتراحات مشابهة
                  </button>
                </div>
              ) : null}

              {showError ? (
                <div className="glass rounded-2xl p-6 text-center shadow-[var(--shadow-deep)]">
                  <p className="text-sm text-[var(--text-secondary)]">
                    تعذّر تنفيذ البحث. تحقق من اتصالك وحاول مجددًا.
                  </p>
                </div>
              ) : null}

              {tooShort ? (
                <p className="px-2 pt-2 text-center text-xs text-[var(--text-muted)]">
                  اكتب حرفين على الأقل — يمكنك البحث باسم العطر أو نوتاته أو
                  اسم العطر العالمي الذي يستوحي منه.
                </p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
