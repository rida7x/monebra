'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, TriangleAlert, Package } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export type PickableVariant = {
  id: string;
  label: string;
  price: number;
  stock: number;
  productId: string;
  productName: string;
};

export type BundleItemRow = {
  variantId: string;
  quantity: number;
};

/**
 * اختيار أصناف الباقة.
 *
 * ⚠️ ملاحظة مهمة في التصميم: **مخزون الباقة مستقل عن مخزون أصنافها**.
 * الباقة منتج له مخزونه الخاص يحدّده المدير — لأن الباقات عادةً تُجهَّز
 * مسبقًا كوحدات جاهزة، لا تُركَّب لحظة الطلب.
 *
 * لهذا نعرض تنبيهًا عندما ينفد أحد أصنافها: النظام لن يمنع البيع تلقائيًا،
 * والقرار للمدير. إخفاء هذه الحقيقة كان سيجعله يفاجأ بطلب لا يستطيع
 * تجهيزه.
 */
export function BundleItemsPicker({
  items,
  onChange,
  available,
  currencySymbol,
  currencyDecimals,
}: {
  items: BundleItemRow[];
  onChange: (items: BundleItemRow[]) => void;
  available: PickableVariant[];
  currencySymbol: string;
  currencyDecimals: number;
}) {
  const [search, setSearch] = useState('');

  const byId = useMemo(
    () => new Map(available.map((variant) => [variant.id, variant])),
    [available],
  );

  const chosen = new Set(items.map((item) => item.variantId));

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();

    return available
      .filter((variant) => !chosen.has(variant.id))
      .filter((variant) =>
        query
          ? `${variant.productName} ${variant.label}`.toLowerCase().includes(query)
          : true,
      )
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, search, items]);

  const money = (minor: number) =>
    formatMoney(minor, { currency: currencySymbol, decimals: currencyDecimals });

  // مجموع أسعار الأصناف منفردة — يوضّح للمدير حجم الخصم الذي يقدّمه
  const itemsTotal = items.reduce((sum, item) => {
    const variant = byId.get(item.variantId);
    return sum + (variant ? variant.price * item.quantity : 0);
  }, 0);

  const outOfStock = items.filter((item) => {
    const variant = byId.get(item.variantId);
    return variant && variant.stock <= 0;
  });

  return (
    <div className="space-y-4">
      {/* ── الأصناف المختارة ── */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--surface-border-strong)] p-4 text-center text-sm text-[var(--text-muted)]">
          لم تُضَف أصناف بعد. ابحث أدناه وأضف العطور التي تتكوّن منها الباقة.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const variant = byId.get(item.variantId);

            if (!variant) {
              return (
                <li
                  key={item.variantId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 p-3 text-sm"
                >
                  <span className="text-[var(--color-danger)]">
                    حجم لم يعد موجودًا — احذفه
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                    aria-label="حذف الصنف"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </li>
              );
            }

            return (
              <li
                key={item.variantId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--surface-border)] p-3"
              >
                <Package
                  size={16}
                  className="shrink-0 text-[var(--text-muted)]"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {variant.productName}
                  </p>
                  <p className="tabular text-xs text-[var(--text-muted)]">
                    {variant.label} · {money(variant.price)}
                    {variant.stock <= 0 ? (
                      <span className="ms-2 text-[var(--color-danger)]">
                        نفد المخزون
                      </span>
                    ) : (
                      <span className="ms-2">المتاح {variant.stock}</span>
                    )}
                  </p>
                </div>

                <label className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">الكمية</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={item.quantity}
                    onChange={(event) => {
                      const quantity = Math.max(
                        1,
                        Math.min(20, Number(event.target.value) || 1),
                      );
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, quantity } : row,
                        ),
                      );
                    }}
                    aria-label={`كمية ${variant.productName}`}
                    className="tabular h-9 w-16 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 text-center text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  aria-label={`حذف ${variant.productName} من الباقة`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── تنبيه نفاد أحد الأصناف ── */}
      {outOfStock.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 p-3 text-xs leading-relaxed text-[var(--color-warning)]">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            نفد مخزون {outOfStock.length}{' '}
            {outOfStock.length === 1 ? 'صنف' : 'أصناف'} من هذه الباقة. مخزون
            الباقة مستقل، فلن يمنع النظام بيعها — تأكد أنك قادر على تجهيزها.
          </span>
        </p>
      ) : null}

      {/* ── مقارنة السعر ── */}
      {items.length > 0 ? (
        <p className="tabular rounded-lg bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-secondary)]">
          مجموع الأصناف منفردة: {money(itemsTotal)} — اجعل سعر الباقة أقل من
          هذا الرقم ليكون العرض مغريًا.
        </p>
      ) : null}

      {/* ── البحث والإضافة ── */}
      <div>
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث عن عطر لإضافته"
            aria-label="ابحث عن عطر لإضافته إلى الباقة"
            className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        {results.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {results.map((variant) => (
              <li key={variant.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...items, { variantId: variant.id, quantity: 1 }]);
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <Plus
                    size={14}
                    className="shrink-0 text-[var(--accent)]"
                    aria-hidden
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {variant.productName}
                    </span>
                    <span className="tabular text-xs text-[var(--text-muted)]">
                      {variant.label} · {money(variant.price)}
                    </span>
                  </span>

                  <span
                    className={cn(
                      'tabular shrink-0 text-xs',
                      variant.stock <= 0
                        ? 'text-[var(--color-danger)]'
                        : 'text-[var(--text-muted)]',
                    )}
                  >
                    {variant.stock <= 0 ? 'نفد' : variant.stock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : search.trim() ? (
          <p className="mt-2 px-3 py-2 text-xs text-[var(--text-muted)]">
            لا نتائج مطابقة
          </p>
        ) : null}
      </div>
    </div>
  );
}
