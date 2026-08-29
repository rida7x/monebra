'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal, X, Check, ArrowUpDown } from 'lucide-react';
import {
  GENDERS,
  GENDER_LABELS,
  SEASONS,
  SEASON_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  INTENSITY_LABELS,
  type ProductSort,
} from '@/lib/constants';
import { toMajor } from '@/lib/money';
import { cn } from '@/lib/utils';

export type FilterOptions = {
  families: string[];
  sizes: number[];
  notes: { name: string; count: number }[];
  minPrice: number;
  maxPrice: number;
};

/**
 * الفلاتر.
 *
 * الحالة كلها في الـ URL وليست في React، لثلاثة أسباب:
 *  • رابط النتائج قابل للمشاركة والحفظ — مهم لروابط TikTok
 *  • زر الرجوع في المتصفح يعمل كما يتوقع المستخدم
 *  • النتائج تُبنى على الخادم، فلا نرسل الكتالوج كاملًا إلى المتصفح
 *
 * `router.replace` مع `scroll: false` داخل `startTransition` يحدّث القائمة
 * بلا إعادة تحميل الصفحة وبلا قفزة إلى الأعلى.
 */
export function ProductFilters({
  options,
  totalResults,
  currencySymbol,
}: {
  options: FilterOptions;
  totalResults: number;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page'); // أي تغيير في الفلاتر يعيدنا للصفحة الأولى

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname, searchParams],
  );

  /** تبديل قيمة داخل معامل متعدد القيم مفصول بفواصل */
  const toggleValue = useCallback(
    (key: string, value: string) => {
      apply((params) => {
        const current = (params.get(key) ?? '')
          .split(',')
          .filter(Boolean);

        const next = current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value];

        if (next.length === 0) params.delete(key);
        else params.set(key, next.join(','));
      });
    },
    [apply],
  );

  const toggleFlag = useCallback(
    (key: string) => {
      apply((params) => {
        if (params.get(key) === '1') params.delete(key);
        else params.set(key, '1');
      });
    },
    [apply],
  );

  const setSingle = useCallback(
    (key: string, value: string | null) => {
      apply((params) => {
        if (!value) params.delete(key);
        else params.set(key, value);
      });
    },
    [apply],
  );

  const has = (key: string, value: string) =>
    (searchParams.get(key) ?? '').split(',').includes(value);

  const flagOn = (key: string) => searchParams.get(key) === '1';

  const activeCount = countActive(searchParams);

  function clearAll() {
    const params = new URLSearchParams();
    const query = searchParams.get('q');
    if (query) params.set('q', query);

    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params}` : pathname,
        { scroll: false },
      );
    });
  }

  const panel = (
    <div className="space-y-7">
      <FilterGroup title="الجنس">
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((gender) => (
            <Chip
              key={gender}
              active={has('gender', gender)}
              onClick={() => toggleValue('gender', gender)}
            >
              {GENDER_LABELS[gender]}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="عروض ومميزات">
        <div className="flex flex-wrap gap-2">
          <Chip active={flagOn('offers')} onClick={() => toggleFlag('offers')}>
            عليها خصم
          </Chip>
          <Chip active={flagOn('new')} onClick={() => toggleFlag('new')}>
            وصل حديثًا
          </Chip>
          <Chip active={flagOn('best')} onClick={() => toggleFlag('best')}>
            الأكثر مبيعًا
          </Chip>
          <Chip
            active={flagOn('instock')}
            onClick={() => toggleFlag('instock')}
          >
            المتوفر فقط
          </Chip>
          <Chip
            active={flagOn('bundles')}
            onClick={() => toggleFlag('bundles')}
          >
            الباقات
          </Chip>
        </div>
      </FilterGroup>

      {options.sizes.length > 0 ? (
        <FilterGroup title="الحجم">
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((size) => (
              <Chip
                key={size}
                active={has('size', String(size))}
                onClick={() => toggleValue('size', String(size))}
              >
                {size} مل
              </Chip>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="السعر">
        <PriceRange
          min={options.minPrice}
          max={options.maxPrice}
          currentMin={searchParams.get('min')}
          currentMax={searchParams.get('max')}
          currencySymbol={currencySymbol}
          onApply={(min, max) =>
            apply((params) => {
              if (min) params.set('min', min);
              else params.delete('min');
              if (max) params.set('max', max);
              else params.delete('max');
            })
          }
        />
      </FilterGroup>

      {options.families.length > 0 ? (
        <FilterGroup title="نوع الرائحة">
          <div className="flex flex-wrap gap-2">
            {options.families.map((family) => (
              <Chip
                key={family}
                active={has('family', family)}
                onClick={() => toggleValue('family', family)}
              >
                {family}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="قوة الثبات">
        <IntensityPicker
          current={searchParams.get('longevity')}
          onSelect={(value) => setSingle('longevity', value)}
        />
      </FilterGroup>

      <FilterGroup title="قوة الفوحان">
        <IntensityPicker
          current={searchParams.get('sillage')}
          onSelect={(value) => setSingle('sillage', value)}
        />
      </FilterGroup>

      <FilterGroup title="الموسم">
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <Chip
              key={season}
              active={has('season', season)}
              onClick={() => toggleValue('season', season)}
            >
              {SEASON_LABELS[season]}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="المناسبة">
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((occasion) => (
            <Chip
              key={occasion}
              active={has('occasion', occasion)}
              onClick={() => toggleValue('occasion', occasion)}
            >
              {OCCASION_LABELS[occasion]}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      {options.notes.length > 0 ? (
        <FilterGroup title="النوتات">
          <div className="flex flex-wrap gap-2">
            {options.notes.slice(0, 18).map((note) => (
              <Chip
                key={note.name}
                active={has('note', note.name)}
                onClick={() => toggleValue('note', note.name)}
              >
                {note.name}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      ) : null}
    </div>
  );

  return (
    <>
      {/* ── شريط الأدوات ── */}
      <div className="mb-6 flex items-center justify-between gap-3 lg:col-span-2 lg:row-start-1">
        <p
          className="text-sm text-[var(--text-secondary)]"
          aria-live="polite"
          aria-busy={pending}
        >
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {totalResults}
          </span>{' '}
          {totalResults === 1 ? 'منتج' : 'منتج'}
        </p>

        <div className="flex items-center gap-2">
          <SortSelect
            value={(searchParams.get('sort') as ProductSort) ?? 'featured'}
            onChange={(value) =>
              setSingle('sort', value === 'featured' ? null : value)
            }
          />

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="tap-target relative flex items-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-4 text-sm transition-colors hover:border-[var(--accent)] lg:hidden"
          >
            <SlidersHorizontal size={15} aria-hidden />
            فلترة
            {activeCount > 0 ? (
              <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.65rem] font-bold text-[var(--accent-contrast)]">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ── لوحة جانبية على الشاشات الكبيرة ── */}
      <aside
        className={cn(
          'hidden lg:col-start-1 lg:row-start-2 lg:block',
          pending && 'pointer-events-none opacity-60',
        )}
        aria-label="فلاتر المنتجات"
      >
        <div className="sticky top-28 max-h-[calc(100dvh-9rem)] overflow-y-auto pe-2">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--surface-border)] py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            >
              <X size={13} aria-hidden />
              مسح الفلاتر ({activeCount})
            </button>
          ) : null}

          {panel}
        </div>
      </aside>

      {/* ── ورقة سفلية على الهاتف ── */}
      <AnimatePresence>
        {sheetOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="فلاتر المنتجات"
          >
            <button
              type="button"
              aria-label="إغلاق الفلاتر"
              onClick={() => setSheetOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-[var(--surface-raised)] shadow-[var(--shadow-deep)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
                <h2 className="text-base font-semibold">الفلاتر</h2>

                <div className="flex items-center gap-3">
                  {activeCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-[var(--color-danger)]"
                    >
                      مسح الكل
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    aria-label="إغلاق"
                    className="tap-target flex items-center justify-center rounded-full text-[var(--text-secondary)]"
                  >
                    <X size={20} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6">{panel}</div>

              <div className="border-t border-[var(--surface-border)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="tap-target w-full rounded-full bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-contrast)]"
                >
                  عرض {totalResults} منتج
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

// ────────────────────────── عناصر داخلية ──────────────────────────

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-[var(--text-muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs transition-all duration-300',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)] hover:text-[var(--text-primary)]',
      )}
    >
      {active ? <Check size={12} aria-hidden /> : null}
      {children}
    </button>
  );
}

function IntensityPicker({
  current,
  onSelect,
}: {
  current: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[3, 4, 5].map((level) => {
        const active = current === String(level);
        return (
          <Chip
            key={level}
            active={active}
            onClick={() => onSelect(active ? null : String(level))}
          >
            {INTENSITY_LABELS[level]} فأكثر
          </Chip>
        );
      })}
    </div>
  );
}

function PriceRange({
  min,
  max,
  currentMin,
  currentMax,
  currencySymbol,
  onApply,
}: {
  min: number;
  max: number;
  currentMin: string | null;
  currentMax: string | null;
  currencySymbol: string;
  onApply: (min: string, max: string) => void;
}) {
  const [from, setFrom] = useState(currentMin ?? '');
  const [to, setTo] = useState(currentMax ?? '');

  const floor = Math.floor(toMajor(min));
  const ceiling = Math.ceil(toMajor(max));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          placeholder={String(floor)}
          aria-label="أقل سعر"
          min={0}
          className="h-10 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm tabular outline-none focus:border-[var(--accent)]"
        />
        <span className="text-xs text-[var(--text-muted)]">إلى</span>
        <input
          type="number"
          inputMode="decimal"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder={String(ceiling)}
          aria-label="أعلى سعر"
          min={0}
          className="h-10 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm tabular outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] text-[var(--text-muted)]">
          النطاق: {floor} – {ceiling} {currencySymbol}
        </p>

        <button
          type="button"
          onClick={() => onApply(from, to)}
          className="rounded-full border border-[var(--surface-border-strong)] px-4 py-1.5 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          تطبيق
        </button>
      </div>
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: ProductSort;
  onChange: (value: ProductSort) => void;
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">ترتيب المنتجات</span>

      <ArrowUpDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute start-3 text-[var(--text-muted)]"
      />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSort)}
        className="tap-target appearance-none rounded-full border border-[var(--surface-border-strong)] bg-[var(--surface-base)] ps-9 pe-4 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--accent)] focus:border-[var(--accent)]"
      >
        {PRODUCT_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {PRODUCT_SORT_LABELS[sort]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** عدد الفلاتر المفعّلة — يستثني البحث والترتيب والصفحة */
function countActive(params: URLSearchParams): number {
  const ignored = new Set(['q', 'sort', 'page', 'per']);
  let count = 0;

  for (const [key, value] of params.entries()) {
    if (ignored.has(key) || !value) continue;
    count += value.split(',').filter(Boolean).length;
  }

  return count;
}
