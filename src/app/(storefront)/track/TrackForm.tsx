'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from '@/lib/constants';
import type { OrderDetail } from '@/lib/services/orders';
import { cn } from '@/lib/utils';

type TrackResponse = {
  order: OrderDetail;
  currency: { symbol: string; decimals: number };
};

/**
 * تتبّع الطلب.
 *
 * يطلب رقم الطلب **ورقم الهاتف** معًا. رقم الطلب متسلسل ويسهل تخمينه،
 * فبدون الهاتف يستطيع أي شخص تصفّح طلبات الآخرين وقراءة عناوينهم.
 *
 * الخادم يعيد رسالة واحدة عند الفشل مهما كان سببه، فلا يعرف المخمّن أي
 * الحقلين كان صحيحًا.
 */
export function TrackForm() {
  const searchParams = useSearchParams();

  const [orderNumber, setOrderNumber] = useState(
    searchParams.get('number') ?? '',
  );
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResponse | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!orderNumber.trim() || !phone.trim()) {
      setError('أدخل رقم الطلب ورقم الهاتف.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone }),
      });

      const data = (await response.json()) as Partial<TrackResponse> & {
        error?: string;
      };

      if (!response.ok || !data.order) {
        setError(data.error ?? 'تعذّر العثور على الطلب.');
        return;
      }

      setResult(data as TrackResponse);
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={submit} className="surface-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="orderNumber"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
            >
              رقم الطلب
            </label>
            <input
              id="orderNumber"
              value={orderNumber}
              onChange={(event) =>
                setOrderNumber(event.target.value.toUpperCase())
              }
              placeholder="MON-10001"
              dir="ltr"
              maxLength={32}
              className="tabular h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3.5 text-start text-sm outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="trackPhone"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
            >
              رقم الهاتف
            </label>
            <input
              id="trackPhone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="09XXXXXXXX"
              maxLength={25}
              className="tabular h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3.5 text-start text-sm outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="tap-target mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden />
              جارٍ البحث…
            </>
          ) : (
            <>
              <Search size={15} aria-hidden />
              تتبّع الطلب
            </>
          )}
        </button>
      </form>

      {result ? (
        <TrackResult data={result} />
      ) : (
        <p className="mt-5 text-center text-xs leading-relaxed text-[var(--text-muted)]">
          نطلب رقم الهاتف مع رقم الطلب لحماية بياناتك من اطّلاع الآخرين.
        </p>
      )}
    </div>
  );
}

function TrackResult({ data }: { data: TrackResponse }) {
  const { order, currency } = data;

  const money = (minor: number) =>
    formatMoney(minor, {
      currency: currency.symbol,
      decimals: currency.decimals,
    });

  const status = order.status as OrderStatus;
  const validStatus = ORDER_STATUSES.includes(status) ? status : 'new';
  const isCancelled = validStatus === 'cancelled' || validStatus === 'returned';

  return (
    <section className="surface-card mt-6 p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tabular text-lg font-bold text-[var(--accent)]">
            {order.orderNumber}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {formatDate(order.createdAt, 'datetime')}
          </p>
        </div>

        <span
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold',
            isCancelled
              ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
              : validStatus === 'delivered'
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : 'bg-[var(--accent)]/15 text-[var(--accent)]',
          )}
        >
          {ORDER_STATUS_LABELS[validStatus]}
        </span>
      </div>

      <div className="my-5 h-px bg-[var(--surface-border)]" />

      <ul className="space-y-2.5">
        {order.items.map((item, index) => (
          <li
            key={index}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0">
              <span className="line-clamp-1">{item.productName}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {item.variantLabel} · ×{item.quantity}
              </span>
            </span>
            <span className="tabular shrink-0 font-medium">
              {money(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="my-4 h-px bg-[var(--surface-border)]" />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">الإجمالي</span>
        <span className="tabular text-lg font-semibold text-[var(--accent)]">
          {money(order.total)}
        </span>
      </div>

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        التوصيل إلى {order.cityName}
        {order.areaName ? ` — ${order.areaName}` : ''}
      </p>
    </section>
  );
}
