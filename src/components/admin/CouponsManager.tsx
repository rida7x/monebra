'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  X,
  BadgePercent,
  Copy,
  Check,
} from 'lucide-react';
import { Field, Toggle, inputClass } from '@/components/admin/form';
import { toMajor, formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  minOrderTotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  orderCount: number;
};

/**
 * إدارة الكوبونات.
 *
 * ⚠️ تنبيه للمستخدم مشروح في الواجهة: قيمة الخصم تعني نسبة مئوية أو مبلغًا
 * ثابتًا حسب النوع المختار. الخلط بينهما (كتابة ٥٠ بنية «٥٠٪» في كوبون
 * مبلغ ثابت) أكثر أخطاء إدارة الكوبونات شيوعًا وأغلاها.
 */
export function CouponsManager({
  coupons,
  currencySymbol,
  currencyDecimals,
}: {
  coupons: CouponRow[];
  currencySymbol: string;
  currencyDecimals: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const money = (minor: number) =>
    formatMoney(minor, { currency: currencySymbol, decimals: currencyDecimals });

  function describe(coupon: CouponRow): string {
    const amount =
      coupon.type === 'percent'
        ? `${coupon.value}٪`
        : money(coupon.value);

    const parts = [`خصم ${amount}`];

    if (coupon.minOrderTotal > 0) {
      parts.push(`للطلبات فوق ${money(coupon.minOrderTotal)}`);
    }
    if (coupon.maxDiscount !== null) {
      parts.push(`بحد أقصى ${money(coupon.maxDiscount)}`);
    }

    return parts.join(' · ');
  }

  function status(coupon: CouponRow): { label: string; tone: string } {
    const now = new Date();

    if (!coupon.isActive) return { label: 'معطّل', tone: 'muted' };
    if (coupon.startsAt && coupon.startsAt > now) {
      return { label: 'لم يبدأ', tone: 'info' };
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      return { label: 'منتهٍ', tone: 'danger' };
    }
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return { label: 'نفد', tone: 'danger' };
    }
    return { label: 'فعّال', tone: 'success' };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {coupons.length}
          </span>{' '}
          كوبون
        </p>

        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus size={16} aria-hidden />
          كوبون جديد
        </button>
      </div>

      {creating ? (
        <CouponEditor
          coupon={null}
          currencySymbol={currencySymbol}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {coupons.length === 0 && !creating ? (
        <p className="surface-card px-4 py-12 text-center text-sm text-[var(--text-muted)]">
          لا توجد كوبونات بعد. أنشئ كوبونًا ليستطيع العميل إدخاله عند إتمام
          الطلب.
        </p>
      ) : null}

      <div className="space-y-3">
        {coupons.map((coupon) =>
          editing === coupon.id ? (
            <CouponEditor
              key={coupon.id}
              coupon={coupon}
              currencySymbol={currencySymbol}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div key={coupon.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <BadgePercent
                  size={18}
                  className={cn(
                    'mt-0.5 shrink-0',
                    coupon.isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)]',
                  )}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code
                      dir="ltr"
                      className="rounded bg-[var(--surface-sunken)] px-2 py-1 text-sm font-bold tracking-wider"
                    >
                      {coupon.code}
                    </code>

                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(coupon.code);
                        setCopied(coupon.id);
                        window.setTimeout(() => setCopied(null), 1500);
                      }}
                      aria-label={`نسخ الكود ${coupon.code}`}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      {copied === coupon.id ? (
                        <Check size={13} className="text-[var(--color-success)]" aria-hidden />
                      ) : (
                        <Copy size={13} aria-hidden />
                      )}
                    </button>

                    <StatusChip {...status(coupon)} />
                  </div>

                  <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                    {describe(coupon)}
                  </p>

                  {coupon.description ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {coupon.description}
                    </p>
                  ) : null}

                  <p className="tabular mt-2 text-xs text-[var(--text-muted)]">
                    استُخدم {coupon.usageCount}
                    {coupon.usageLimit !== null ? ` من ${coupon.usageLimit}` : ' مرة'}
                    {coupon.startsAt || coupon.endsAt ? ' · ' : ''}
                    {coupon.startsAt ? `من ${formatDate(coupon.startsAt)}` : ''}
                    {coupon.endsAt ? ` إلى ${formatDate(coupon.endsAt)}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(coupon.id);
                    setCreating(false);
                  }}
                  aria-label={`تعديل الكوبون ${coupon.code}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
                >
                  <Pencil size={15} aria-hidden />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: string }) {
  const tones: Record<string, string> = {
    success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    danger: 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
    info: 'bg-[var(--color-info)]/12 text-[var(--color-info)]',
    muted: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[0.65rem] font-semibold',
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}

function CouponEditor({
  coupon,
  currencySymbol,
  onDone,
  onCancel,
}: {
  coupon: CouponRow | null;
  currencySymbol: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [type, setType] = useState(coupon?.type ?? 'percent');
  const [value, setValue] = useState(
    coupon
      ? String(coupon.type === 'percent' ? coupon.value : toMajor(coupon.value))
      : '',
  );
  const [minOrderTotal, setMinOrderTotal] = useState(
    coupon ? String(toMajor(coupon.minOrderTotal)) : '0',
  );
  const [maxDiscount, setMaxDiscount] = useState(
    coupon?.maxDiscount != null ? String(toMajor(coupon.maxDiscount)) : '',
  );
  const [usageLimit, setUsageLimit] = useState(
    coupon?.usageLimit != null ? String(coupon.usageLimit) : '',
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    coupon?.perCustomerLimit != null ? String(coupon.perCustomerLimit) : '',
  );
  const [startsAt, setStartsAt] = useState(toDateInput(coupon?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInput(coupon?.endsAt));
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError('أدخل قيمة خصم أكبر من صفر');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: coupon?.id,
          code: code.trim().toUpperCase(),
          description: description.trim() || null,
          type,
          value: numericValue,
          minOrderTotal: Number(minOrderTotal || 0),
          maxDiscount: maxDiscount.trim() === '' ? null : Number(maxDiscount),
          usageLimit: usageLimit.trim() === '' ? null : Number(usageLimit),
          perCustomerLimit:
            perCustomerLimit.trim() === '' ? null : Number(perCustomerLimit),
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          isActive,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حفظ الكوبون');
        setSaving(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setSaving(false);
    }
  }

  async function remove() {
    if (!coupon) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/coupons?id=${coupon.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر الحذف');
        setDeleting(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setDeleting(false);
    }
  }

  const key = coupon?.id ?? 'new';
  const isPercent = type === 'percent';

  return (
    <div className="surface-card border-[var(--accent)]/50 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {coupon ? `تعديل ${coupon.code}` : 'كوبون جديد'}
        </h3>

        <button
          type="button"
          onClick={onCancel}
          aria-label="إغلاق"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="الكود"
          htmlFor={`code-${key}`}
          required
          hint="حروف لاتينية وأرقام فقط"
        >
          <input
            id={`code-${key}`}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            dir="ltr"
            placeholder="WELCOME10"
            maxLength={40}
            className={`${inputClass} text-start font-bold tracking-wider`}
          />
        </Field>

        <Field label="نوع الخصم" htmlFor={`type-${key}`} required>
          <select
            id={`type-${key}`}
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={inputClass}
          >
            <option value="percent">نسبة مئوية ٪</option>
            <option value="fixed">مبلغ ثابت {currencySymbol}</option>
          </select>
        </Field>

        <Field
          label={isPercent ? 'النسبة (٪)' : `المبلغ (${currencySymbol})`}
          htmlFor={`value-${key}`}
          required
          hint={isPercent ? 'من ١ إلى ١٠٠' : 'يُخصم من قيمة المنتجات'}
        >
          <input
            id={`value-${key}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            type="number"
            min={0}
            max={isPercent ? 100 : undefined}
            step={isPercent ? 1 : 0.5}
            inputMode="decimal"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field
          label={`أقل قيمة طلب (${currencySymbol})`}
          htmlFor={`min-${key}`}
          hint="صفر = بلا حد أدنى"
        >
          <input
            id={`min-${key}`}
            value={minOrderTotal}
            onChange={(event) => setMinOrderTotal(event.target.value)}
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field
          label={`أقصى خصم (${currencySymbol})`}
          htmlFor={`max-${key}`}
          hint={isPercent ? 'يحمي من خصم ضخم على طلب كبير' : 'غير مستخدم مع المبلغ الثابت'}
        >
          <input
            id={`max-${key}`}
            value={maxDiscount}
            onChange={(event) => setMaxDiscount(event.target.value)}
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            placeholder="بلا حد"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field
          label="حد الاستخدام الكلي"
          htmlFor={`usage-${key}`}
          hint="اتركه فارغًا لاستخدام غير محدود"
        >
          <input
            id={`usage-${key}`}
            value={usageLimit}
            onChange={(event) => setUsageLimit(event.target.value)}
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="غير محدود"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field
          label="حد الاستخدام لكل عميل"
          htmlFor={`per-${key}`}
          hint="يُحسب برقم الهاتف"
        >
          <input
            id={`per-${key}`}
            value={perCustomerLimit}
            onChange={(event) => setPerCustomerLimit(event.target.value)}
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="غير محدود"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field label="تاريخ البدء" htmlFor={`start-${key}`}>
          <input
            id={`start-${key}`}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            type="date"
            className={inputClass}
          />
        </Field>

        <Field label="تاريخ الانتهاء" htmlFor={`end-${key}`}>
          <input
            id={`end-${key}`}
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            type="date"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="وصف داخلي" htmlFor={`desc-${key}`} hint="لك أنت — لا يراه العميل">
          <input
            id={`desc-${key}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Toggle label="مفعّل" checked={isActive} onChange={setIsActive} />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || deleting}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          حفظ
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
        >
          إلغاء
        </button>

        {coupon && coupon.orderCount === 0 ? (
          <button
            type="button"
            onClick={remove}
            disabled={saving || deleting}
            className="tap-target ms-auto inline-flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/50 px-5 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Trash2 size={14} aria-hidden />
            )}
            حذف
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** يحوّل التاريخ إلى صيغة حقل input[type=date] */
function toDateInput(date: Date | null | undefined): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
