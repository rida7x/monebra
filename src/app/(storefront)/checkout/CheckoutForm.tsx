'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ShoppingBag,
  Truck,
  BadgePercent,
  TriangleAlert,
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '@/stores/cart';
import { toast } from '@/stores/toast';
import { track } from '@/components/analytics/Tracker';
import { formatMoney } from '@/lib/money';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { CartItem, CartIssue } from '@/lib/services/cart';
import type { CityOption } from '@/lib/services/delivery';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { cn } from '@/lib/utils';

type Quote = {
  items: CartItem[];
  issues: CartIssue[];
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  savings: number;
  freeDeliveryApplied: boolean;
  coupon: { code: string; amount: number } | null;
  couponError: string | null;
  delivery: { cityName: string; areaName: string | null; days: string | null } | null;
  currency: { symbol: string; decimals: number };
  ordersEnabled: boolean;
};

type FieldErrors = Partial<
  Record<'customerName' | 'customerPhone' | 'cityId' | 'addressLine', string>
>;

/**
 * نموذج إتمام الطلب.
 *
 * مبدأ التصميم: خطوة واحدة، أقل عدد حقول ممكن، والملخّص مرئي دائمًا.
 *
 * ⚠️ كل مبلغ يظهر هنا يأتي من `/api/checkout/quote` أي من الخادم. النموذج
 * لا يحسب شيئًا ولا يرسل أي سعر — يرسل معرّفات وكميات وبيانات تواصل فقط.
 * عند التأكيد يعيد الخادم الحساب مرة أخرى قبل الحفظ.
 */
export function CheckoutForm({ cities }: { cities: CityOption[] }) {
  const router = useRouter();
  const lines = useCart((state) => state.lines);
  const hydrated = useCart((state) => state.hydrated);
  const clearCart = useCart((state) => state.clear);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cityId, setCityId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCity = cities.find((city) => city.id === cityId);
  const areas = selectedCity?.areas ?? [];

  // بصمة كل ما يؤثر على التسعير — نعيد الطلب عند تغيّرها فقط
  const signature = JSON.stringify({
    lines,
    cityId,
    areaId,
    appliedCoupon,
    phone,
  });

  const fetchQuote = useCallback(async () => {
    const response = await fetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines,
        cityId: cityId || null,
        areaId: areaId || null,
        couponCode: appliedCoupon || null,
        phone: phone || null,
      }),
    });

    if (!response.ok) throw new Error('quote failed');
    return (await response.json()) as Quote;
  }, [lines, cityId, areaId, appliedCoupon, phone]);

  // نسجّل بدء الدفع مرة واحدة عند أول وصول للصفحة بسلة غير فارغة
  const trackedStart = useRef(false);

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;

    if (!trackedStart.current) {
      trackedStart.current = true;
      track('begin_checkout');
    }

    let alive = true;

    (async () => {
      try {
        const data = await fetchQuote();
        if (!alive) return;

        setQuote(data);
        setQuoteFailed(false);

        if (data.couponError && appliedCoupon) {
          toast.error(data.couponError);
          setAppliedCoupon('');
        }
      } catch {
        if (alive) setQuoteFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
    // `signature` يمثّل كل المدخلات المؤثرة على السعر
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, signature]);

  const money = useCallback(
    (minor: number) =>
      formatMoney(minor, {
        currency: quote?.currency.symbol ?? 'د.ل',
        decimals: quote?.currency.decimals ?? 2,
      }),
    [quote],
  );

  function validate(): boolean {
    const next: FieldErrors = {};

    if (name.trim().length < 2) next.customerName = 'أدخل اسمك الكامل';
    if (phone.replace(/\D/g, '').length < 9) {
      next.customerPhone = 'أدخل رقم هاتف صحيح';
    }
    if (!cityId) next.cityId = 'اختر مدينتك';
    if (address.trim().length < 5) {
      next.addressLine = 'أضف تفاصيل العنوان (الحي، الشارع، علامة مميزة)';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      // ننقل التركيز إلى أول حقل خاطئ ليجده مستخدم لوحة المفاتيح وقارئ الشاشة
      document
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines,
          customerName: name,
          customerPhone: phone,
          cityId,
          areaId: areaId || null,
          addressLine: address,
          notes: notes || null,
          couponCode: appliedCoupon || null,
          website: honeypot,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        orderNumber?: string;
        error?: string;
        items?: string[];
      };

      if (!response.ok || !data.ok || !data.orderNumber) {
        const detail = data.items?.length
          ? `${data.error} (${data.items.join('، ')})`
          : (data.error ?? 'تعذّر إنشاء الطلب');

        setFormError(detail);
        setSubmitting(false);
        return;
      }

      // نفرّغ السلة بعد نجاح الطلب فقط — لو فشل يبقى للعميل ما اختاره
      clearCart();
      router.push(`/order/${data.orderNumber}`);
    } catch {
      setFormError('تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.');
      setSubmitting(false);
    }
  }

  // ── الحالات ──
  if (!hydrated) return <CheckoutSkeleton />;

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={40} />}
        title="سلّتك فارغة"
        description="أضف عطرًا إلى السلة قبل إتمام الطلب."
        action={{ href: '/products', label: 'تصفّح العطور' }}
      />
    );
  }

  if (quoteFailed && !quote) {
    return (
      <EmptyState
        icon={<TriangleAlert size={40} />}
        title="تعذّر تحميل بيانات الطلب"
        description="تحقّق من اتصالك بالإنترنت ثم أعد المحاولة."
        action={{ href: '/checkout', label: 'إعادة المحاولة' }}
      />
    );
  }

  if (!quote) return <CheckoutSkeleton />;

  if (!quote.ordersEnabled) {
    return (
      <EmptyState
        icon={<TriangleAlert size={40} />}
        title="استقبال الطلبات متوقّف مؤقتًا"
        description="تواصل معنا عبر واتساب لإتمام طلبك، أو حاول لاحقًا."
        action={{ href: '/cart', label: 'العودة إلى السلة' }}
      />
    );
  }

  return (
    <>
      <CheckoutSteps current={1} />

      <form
        onSubmit={submit}
        noValidate
        className="lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10"
      >
        {/* ═══════════ بيانات التوصيل ═══════════ */}
        <div className="space-y-6">
          <section className="surface-card p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold">
              <Truck size={17} className="text-[var(--accent)]" aria-hidden />
              بيانات التوصيل
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="الاسم الكامل"
                required
                error={errors.customerName}
                htmlFor="name"
              >
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  aria-invalid={Boolean(errors.customerName)}
                  className={inputClass(Boolean(errors.customerName))}
                />
              </Field>

              <Field
                label="رقم الهاتف"
                required
                error={errors.customerPhone}
                htmlFor="phone"
                hint="نتواصل معك عليه لتأكيد الطلب"
              >
                <input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="09XXXXXXXX"
                  autoComplete="tel"
                  maxLength={25}
                  aria-invalid={Boolean(errors.customerPhone)}
                  className={cn(
                    inputClass(Boolean(errors.customerPhone)),
                    'tabular text-start',
                  )}
                />
              </Field>

              <Field
                label="المدينة"
                required
                error={errors.cityId}
                htmlFor="city"
              >
                <select
                  id="city"
                  value={cityId}
                  onChange={(event) => {
                    setCityId(event.target.value);
                    setAreaId('');
                  }}
                  aria-invalid={Boolean(errors.cityId)}
                  className={inputClass(Boolean(errors.cityId))}
                >
                  <option value="">اختر المدينة</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="المنطقة"
                htmlFor="area"
                hint={
                  !cityId
                    ? 'اختر المدينة أولًا'
                    : areas.length === 0
                      ? 'لا توجد مناطق مسجّلة لهذه المدينة'
                      : undefined
                }
              >
                <select
                  id="area"
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  disabled={areas.length === 0}
                  className={cn(inputClass(false), 'disabled:opacity-50')}
                >
                  <option value="">
                    {areas.length === 0 ? '—' : 'اختر المنطقة'}
                  </option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="العنوان بالتفصيل"
                required
                error={errors.addressLine}
                htmlFor="address"
                hint="الحي، الشارع، وعلامة مميزة قريبة"
              >
                <textarea
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={3}
                  maxLength={500}
                  autoComplete="street-address"
                  aria-invalid={Boolean(errors.addressLine)}
                  className={cn(inputClass(Boolean(errors.addressLine)), 'h-auto py-3')}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="ملاحظات إضافية" htmlFor="notes">
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="وقت مناسب للتوصيل، أو أي تفاصيل تريد إخبارنا بها"
                  className={cn(inputClass(false), 'h-auto py-3')}
                />
              </Field>
            </div>

            {/* حقل فخّ مخفي عن الإنسان ومرئي للآليّ */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">اتركه فارغًا</label>
              <input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>
          </section>

          {/* ═══════════ طريقة الدفع ═══════════ */}
          <section className="surface-card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <ShieldCheck
                size={17}
                className="text-[var(--accent)]"
                aria-hidden
              />
              طريقة الدفع
            </h2>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/8 p-4">
              <input
                type="radio"
                name="payment"
                value="cod"
                defaultChecked
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">
                  {PAYMENT_METHOD_LABELS.cod}
                </span>
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                  تدفع للمندوب نقدًا عند استلام طلبك.
                </span>
              </span>
            </label>
          </section>
        </div>

        {/* ═══════════ الملخّص ═══════════ */}
        <aside className="mt-8 lg:sticky lg:top-28 lg:mt-0">
          <div className="surface-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">ملخّص الطلب</h2>
            <div className="my-4 h-px rule-gold" />

            {/* الأصناف */}
            <ul className="max-h-64 space-y-3 overflow-y-auto pe-1">
              {quote.items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center font-display text-lg text-[var(--text-muted)]/30"
                        aria-hidden
                      >
                        M
                      </span>
                    )}
                    <span className="tabular absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.6rem] font-bold text-[var(--accent-contrast)]">
                      {item.quantity}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {item.productName}
                    </p>
                    <p className="text-[0.7rem] text-[var(--text-muted)]">
                      {item.variantLabel}
                    </p>
                  </div>

                  <span className="tabular shrink-0 text-xs font-semibold">
                    {money(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-4 h-px bg-[var(--surface-border)]" />

            {/* كود الخصم */}
            <div className="mb-4">
              <label
                htmlFor="coupon"
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"
              >
                <BadgePercent size={13} aria-hidden />
                كود الخصم
              </label>

              {quote.coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3 py-2.5">
                  <span className="text-xs font-semibold text-[var(--color-success)]">
                    {quote.coupon.code} — {money(quote.coupon.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon('');
                      setCouponInput('');
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                  >
                    إزالة
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="coupon"
                    value={couponInput}
                    onChange={(event) =>
                      setCouponInput(event.target.value.toUpperCase())
                    }
                    placeholder="أدخل الكود"
                    maxLength={40}
                    className={cn(inputClass(false), 'h-11 flex-1 text-sm')}
                  />
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(couponInput.trim())}
                    disabled={couponInput.trim().length === 0}
                    className="tap-target shrink-0 rounded-lg border border-[var(--surface-border-strong)] px-4 text-xs font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    تطبيق
                  </button>
                </div>
              )}
            </div>

            {/* الإجماليات */}
            <dl className="space-y-2.5 text-sm">
              <Row label={`المجموع (${quote.itemCount} قطعة)`}>
                {money(quote.subtotal)}
              </Row>

              {quote.discountTotal > 0 ? (
                <Row label="الخصم" tone="success">
                  − {money(quote.discountTotal)}
                </Row>
              ) : null}

              <Row label="التوصيل">
                {!cityId ? (
                  <span className="text-xs text-[var(--text-muted)]">
                    اختر المدينة
                  </span>
                ) : quote.freeDeliveryApplied ? (
                  <span className="text-[var(--color-success)]">مجاني</span>
                ) : quote.deliveryFee === 0 ? (
                  <span className="text-[var(--color-success)]">مجاني</span>
                ) : (
                  money(quote.deliveryFee)
                )}
              </Row>

              {quote.delivery?.days ? (
                <Row label="مدة التوصيل" muted>
                  {quote.delivery.days}
                </Row>
              ) : null}
            </dl>

            <div className="my-4 h-px bg-[var(--surface-border)]" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">الإجمالي</span>
              <span className="tabular text-xl font-semibold text-[var(--accent)]">
                {money(quote.total)}
              </span>
            </div>

            {quote.savings > 0 ? (
              <p className="mt-1.5 text-xs text-[var(--color-success)]">
                وفّرت {money(quote.savings)}
              </p>
            ) : null}

            {formError ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs leading-relaxed text-[var(--color-danger)]"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="tap-target mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-300 hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  جارٍ إرسال الطلب…
                </>
              ) : (
                'تأكيد الطلب'
              )}
            </button>

            <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-[var(--text-muted)]">
              بتأكيدك الطلب توافق على{' '}
              <Link
                href="/pages/return-policy"
                className="underline underline-offset-2 hover:text-[var(--accent)]"
              >
                سياسة الاستبدال والاسترجاع
              </Link>
              .
            </p>

            <Link
              href="/cart"
              className="mt-3 block text-center text-xs text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
            >
              تعديل السلة
            </Link>
          </div>
        </aside>
      </form>
    </>
  );
}

// ────────────────────────── عناصر داخلية ──────────────────────────

function inputClass(hasError: boolean): string {
  return cn(
    'h-12 w-full rounded-lg border bg-[var(--surface-base)] px-3.5 text-sm text-[var(--text-primary)]',
    'outline-none transition-colors placeholder:text-[var(--text-muted)]',
    hasError
      ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
      : 'border-[var(--surface-border)] focus:border-[var(--accent)]',
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
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

function Row({
  label,
  children,
  tone,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'success';
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd
        className={cn(
          'tabular text-end',
          tone === 'success' && 'text-[var(--color-success)]',
          muted && 'text-xs text-[var(--text-muted)]',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
      <div className="space-y-6">
        <div className="surface-card space-y-4 p-6">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>

      <div className="surface-card mt-8 space-y-4 p-6 lg:mt-0">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
