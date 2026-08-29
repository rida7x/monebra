'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, ArrowLeft, TriangleAlert } from 'lucide-react';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  STOCK_RESTORING_STATUSES,
  type OrderStatus,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * تغيير حالة الطلب.
 *
 * لا نعرض إلا الانتقالات المسموحة من الحالة الحالية — نفس القائمة التي
 * يفرضها الخادم. هذا يمنع المدير من محاولة انتقال سيُرفض على أي حال.
 *
 * الانتقالات التي تعيد المخزون (إلغاء/مرتجع) تطلب تأكيدًا صريحًا لأنها
 * غير قابلة للتراجع: الحالة نهائية ولا يمكن العودة منها.
 */
export function OrderStatusControl({
  orderId,
  currentStatus,
  canManage,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];

  if (!canManage) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        ليست لديك صلاحية تغيير حالة الطلب.
      </p>
    );
  }

  if (allowed.length === 0) {
    return (
      <p className="rounded-lg bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-muted)]">
        هذه حالة نهائية — لا يمكن الانتقال منها.
      </p>
    );
  }

  async function apply(status: OrderStatus) {
    setPending(status);
    setError(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: note.trim() || null }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر تغيير الحالة');
        setPending(null);
        return;
      }

      setConfirming(null);
      setNote('');
      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-[var(--color-danger)]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            تأكيد: {ORDER_STATUS_LABELS[confirming]}
          </p>

          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            سيُعاد المخزون المحجوز لهذا الطلب، والحالة نهائية لا يمكن
            التراجع عنها.
          </p>

          <label
            htmlFor="statusNote"
            className="mt-3 mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            سبب الإجراء (اختياري)
          </label>
          <input
            id="statusNote"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="مثال: العميل ألغى الطلب هاتفيًا"
            className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => apply(confirming)}
              disabled={pending !== null}
              className="tap-target flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : null}
              تأكيد
            </button>

            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setNote('');
              }}
              className="tap-target rounded-lg border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
            >
              تراجع
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.map((status) => {
            const destructive = STOCK_RESTORING_STATUSES.includes(status);

            return (
              <button
                key={status}
                type="button"
                onClick={() =>
                  destructive ? setConfirming(status) : apply(status)
                }
                disabled={pending !== null}
                className={cn(
                  'tap-target inline-flex items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50',
                  destructive
                    ? 'border border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                    : 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]',
                )}
              >
                {pending === status ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <ArrowLeft size={14} aria-hidden />
                )}
                {ORDER_STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
