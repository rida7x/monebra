'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  MapPin,
  Pencil,
  X,
} from 'lucide-react';
import { Field, Toggle, inputClass } from '@/components/admin/form';
import { toMajor } from '@/lib/money';
import { cn } from '@/lib/utils';

type AreaRow = {
  id?: string;
  name: string;
  /** فارغ = ترث رسم المدينة */
  deliveryFee: string;
  deliveryDays: string;
  isActive: boolean;
};

type CityRow = {
  id: string;
  name: string;
  deliveryFee: number;
  deliveryDays: string | null;
  isActive: boolean;
  orderCount: number;
  areas: {
    id: string;
    name: string;
    deliveryFeeOverride: number | null;
    deliveryDaysOverride: string | null;
    isActive: boolean;
  }[];
};

/**
 * إدارة المدن ورسوم التوصيل.
 *
 * ⚠️ لا يوجد رسم توصيل واحد مكتوب في الكود. ما يُدخَل هنا هو ما يدفعه
 * العميل فعلًا عند إتمام الطلب.
 *
 * حقل رسم المنطقة **الفارغ يختلف عن الصفر**: الفارغ يعني «مثل المدينة»
 * والصفر يعني «مجاني لهذه المنطقة». هذا التمييز مشروح في الواجهة لأنه
 * أكثر ما يُخطئ فيه المستخدمون.
 */
export function CitiesManager({
  cities,
  currencySymbol,
}: {
  cities: CityRow[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {cities.length}
          </span>{' '}
          مدينة ·{' '}
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {cities.filter((city) => city.isActive).length}
          </span>{' '}
          مفعّلة
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
          مدينة جديدة
        </button>
      </div>

      {creating ? (
        <CityEditor
          city={null}
          currencySymbol={currencySymbol}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <div className="space-y-3">
        {cities.map((city) =>
          editing === city.id ? (
            <CityEditor
              key={city.id}
              city={city}
              currencySymbol={currencySymbol}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <CityCard
              key={city.id}
              city={city}
              currencySymbol={currencySymbol}
              onEdit={() => {
                setEditing(city.id);
                setCreating(false);
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── بطاقة العرض ───────────────────────────

function CityCard({
  city,
  currencySymbol,
  onEdit,
}: {
  city: CityRow;
  currencySymbol: string;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeAreas = city.areas.filter((area) => area.isActive);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <MapPin
          size={17}
          className={cn(
            'shrink-0',
            city.isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {city.name}
            {!city.isActive ? (
              <span className="rounded-full bg-[var(--text-muted)]/15 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--text-muted)]">
                معطّلة
              </span>
            ) : null}
          </p>

          <p className="tabular mt-0.5 text-xs text-[var(--text-muted)]">
            التوصيل {toMajor(city.deliveryFee)} {currencySymbol}
            {city.deliveryDays ? ` · ${city.deliveryDays}` : ''}
            {city.orderCount > 0 ? ` · ${city.orderCount} طلب` : ''}
          </p>
        </div>

        {city.areas.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]"
          >
            {activeAreas.length} منطقة
            <ChevronDown
              size={13}
              aria-hidden
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onEdit}
          aria-label={`تعديل ${city.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
        >
          <Pencil size={15} aria-hidden />
        </button>
      </div>

      {open && city.areas.length > 0 ? (
        <ul className="border-t border-[var(--surface-border)] bg-[var(--surface-sunken)] px-4 py-3">
          {city.areas.map((area) => (
            <li
              key={area.id}
              className="flex items-center justify-between gap-3 py-1.5 text-xs"
            >
              <span
                className={
                  area.isActive ? '' : 'text-[var(--text-muted)] line-through'
                }
              >
                {area.name}
              </span>

              <span className="tabular text-[var(--text-muted)]">
                {area.deliveryFeeOverride === null
                  ? 'مثل المدينة'
                  : `${toMajor(area.deliveryFeeOverride)} ${currencySymbol}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─────────────────────────── المحرّر ───────────────────────────

function CityEditor({
  city,
  currencySymbol,
  onDone,
  onCancel,
}: {
  city: CityRow | null;
  currencySymbol: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(city?.name ?? '');
  const [fee, setFee] = useState(
    city ? String(toMajor(city.deliveryFee)) : '0',
  );
  const [days, setDays] = useState(city?.deliveryDays ?? '');
  const [isActive, setIsActive] = useState(city?.isActive ?? true);
  const [areas, setAreas] = useState<AreaRow[]>(
    city?.areas.map((area) => ({
      id: area.id,
      name: area.name,
      deliveryFee:
        area.deliveryFeeOverride === null
          ? ''
          : String(toMajor(area.deliveryFeeOverride)),
      deliveryDays: area.deliveryDaysOverride ?? '',
      isActive: area.isActive,
    })) ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    if (!name.trim()) {
      setError('أدخل اسم المدينة');
      return;
    }

    const feeValue = Number(fee);
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      setError('رسم التوصيل غير صالح');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: city?.id,
          name: name.trim(),
          deliveryFee: feeValue,
          deliveryDays: days.trim() || null,
          isActive,
          areas: areas
            .filter((area) => area.name.trim())
            .map((area) => ({
              id: area.id,
              name: area.name.trim(),
              // الفارغ يعني «ترث رسم المدينة» — نرسله null لا صفرًا
              deliveryFee:
                area.deliveryFee.trim() === '' ? null : Number(area.deliveryFee),
              deliveryDays: area.deliveryDays.trim() || null,
              isActive: area.isActive,
            })),
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حفظ المدينة');
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
    if (!city) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/cities?id=${city.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حذف المدينة');
        setDeleting(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setDeleting(false);
    }
  }

  return (
    <div className="surface-card border-[var(--accent)]/50 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {city ? `تعديل ${city.name}` : 'مدينة جديدة'}
        </h3>

        <button
          type="button"
          onClick={onCancel}
          aria-label="إغلاق المحرّر"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="اسم المدينة" htmlFor={`city-name-${city?.id ?? 'new'}`} required>
          <input
            id={`city-name-${city?.id ?? 'new'}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field
          label={`رسم التوصيل (${currencySymbol})`}
          htmlFor={`city-fee-${city?.id ?? 'new'}`}
          required
          hint="صفر = توصيل مجاني"
        >
          <input
            id={`city-fee-${city?.id ?? 'new'}`}
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            className={`${inputClass} tabular`}
          />
        </Field>

        <Field
          label="مدة التوصيل"
          htmlFor={`city-days-${city?.id ?? 'new'}`}
          hint="نص حر يظهر للعميل"
        >
          <input
            id={`city-days-${city?.id ?? 'new'}`}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            placeholder="خلال ٢٤ ساعة"
            maxLength={60}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Toggle
          label="مفعّلة"
          checked={isActive}
          onChange={setIsActive}
          hint="المدينة المعطّلة لا تظهر في صفحة إتمام الطلب"
        />
      </div>

      {/* ── المناطق ── */}
      <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[var(--text-muted)]">
            المناطق داخل المدينة
          </h4>

          <button
            type="button"
            onClick={() =>
              setAreas((rows) => [
                ...rows,
                { name: '', deliveryFee: '', deliveryDays: '', isActive: true },
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
          >
            <Plus size={13} aria-hidden />
            إضافة منطقة
          </button>
        </div>

        {areas.length === 0 ? (
          <p className="rounded-lg bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-muted)]">
            بلا مناطق — سيُطبَّق رسم المدينة على كل العناوين فيها.
          </p>
        ) : (
          <div className="space-y-2">
            {areas.map((area, index) => (
              <div
                key={area.id ?? `new-${index}`}
                className="grid gap-2 rounded-lg border border-[var(--surface-border)] p-3 sm:grid-cols-[1fr_8rem_9rem_auto]"
              >
                <input
                  value={area.name}
                  onChange={(event) =>
                    setAreas((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="اسم المنطقة"
                  aria-label={`اسم المنطقة ${index + 1}`}
                  maxLength={80}
                  className={inputClass}
                />

                <input
                  value={area.deliveryFee}
                  onChange={(event) =>
                    setAreas((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, deliveryFee: event.target.value }
                          : row,
                      ),
                    )
                  }
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  placeholder="مثل المدينة"
                  aria-label={`رسم المنطقة ${index + 1}`}
                  title="اتركه فارغًا لاستخدام رسم المدينة، أو صفر للتوصيل المجاني"
                  className={`${inputClass} tabular`}
                />

                <input
                  value={area.deliveryDays}
                  onChange={(event) =>
                    setAreas((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, deliveryDays: event.target.value }
                          : row,
                      ),
                    )
                  }
                  placeholder="مدة مختلفة"
                  aria-label={`مدة المنطقة ${index + 1}`}
                  maxLength={60}
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={() =>
                    setAreas((rows) => rows.filter((_, i) => i !== index))
                  }
                  aria-label={`حذف المنطقة ${index + 1}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))}

            <p className="text-xs text-[var(--text-muted)]">
              رسم المنطقة الفارغ يعني «مثل المدينة». اكتب صفرًا لتوصيل مجاني
              لهذه المنطقة تحديدًا.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
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
          {saving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : null}
          حفظ
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
        >
          إلغاء
        </button>

        {city && city.orderCount === 0 ? (
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
            حذف المدينة
          </button>
        ) : null}
      </div>
    </div>
  );
}
