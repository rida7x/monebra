import Image from 'next/image';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { formatDate, formatPhone } from '@/lib/utils';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  TERMINAL_STATUSES,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';
import type { OrderDetail } from '@/lib/services/orders';
import { cn } from '@/lib/utils';

/**
 * بطاقة تفاصيل الطلب — تُستخدم في صفحة التأكيد وصفحة التتبّع.
 *
 * مكوّن خادم بلا JavaScript: كل ما فيه عرض، ولا حاجة لتفاعل.
 */

/** المسار الطبيعي للطلب — الإلغاء والمرتجع خارجه ويُعرضان بشكل مختلف */
const HAPPY_PATH: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
];

export function OrderStatusTimeline({
  status,
  history,
}: {
  status: OrderStatus;
  history: { toStatus: string; createdAt: Date }[];
}) {
  const isTerminalOffPath = status === 'cancelled' || status === 'returned';

  if (isTerminalOffPath) {
    // آخر مرة دخل فيها الطلب هذه الحالة (السجل مرتّب تصاعديًا بالتاريخ)
    const record = [...history]
      .reverse()
      .find((entry) => entry.toStatus === status);

    return (
      <div className="rounded-xl border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/8 p-4">
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          {ORDER_STATUS_LABELS[status]}
        </p>
        {record ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {formatDate(record.createdAt, 'datetime')}
          </p>
        ) : null}
      </div>
    );
  }

  const currentIndex = HAPPY_PATH.indexOf(status);
  const reachedAt = new Map(
    history.map((entry) => [entry.toStatus, entry.createdAt]),
  );

  return (
    <ol className="space-y-0">
      {HAPPY_PATH.map((step, index) => {
        const done = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const timestamp = reachedAt.get(step);

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'border-[var(--surface-border)] text-[var(--text-muted)]',
                )}
              >
                {done ? <Check size={13} /> : <Circle size={7} />}
              </span>

              {index < HAPPY_PATH.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'w-0.5 flex-1',
                    index < currentIndex
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--surface-border)]',
                  )}
                  style={{ minHeight: '2rem' }}
                />
              ) : null}
            </div>

            <div className={cn('pb-6', index === HAPPY_PATH.length - 1 && 'pb-0')}>
              <p
                className={cn(
                  'text-sm',
                  isCurrent
                    ? 'font-semibold text-[var(--accent)]'
                    : done
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)]',
                )}
              >
                {ORDER_STATUS_LABELS[step]}
              </p>

              {timestamp ? (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {formatDate(timestamp, 'datetime')}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderSummaryCard({
  order,
  currency,
}: {
  order: OrderDetail;
  currency: { symbol: string; decimals: number };
}) {
  const money = (minor: number) =>
    formatMoney(minor, {
      currency: currency.symbol,
      decimals: currency.decimals,
    });

  const status = order.status as OrderStatus;
  const validStatus = ORDER_STATUSES.includes(status) ? status : 'new';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      {/* ── الأصناف والإجماليات ── */}
      <div className="space-y-6">
        <section className="surface-card p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">منتجات الطلب</h2>

          <ul className="space-y-4">
            {order.items.map((item, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
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
                  {item.productSlug ? (
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="line-clamp-1 text-sm font-medium underline-offset-4 hover:text-[var(--accent)] hover:underline"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <p className="line-clamp-1 text-sm font-medium">
                      {item.productName}
                    </p>
                  )}

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.variantLabel} · الكمية {item.quantity}
                  </p>
                </div>

                <span className="tabular shrink-0 text-sm font-semibold">
                  {money(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="my-5 h-px bg-[var(--surface-border)]" />

          <dl className="space-y-2.5 text-sm">
            <SummaryRow label="المجموع">{money(order.subtotal)}</SummaryRow>

            {order.discountTotal > 0 ? (
              <SummaryRow label={`الخصم${order.couponCode ? ` (${order.couponCode})` : ''}`} tone="success">
                − {money(order.discountTotal)}
              </SummaryRow>
            ) : null}

            <SummaryRow label="التوصيل">
              {order.deliveryFee === 0 ? (
                <span className="text-[var(--color-success)]">مجاني</span>
              ) : (
                money(order.deliveryFee)
              )}
            </SummaryRow>
          </dl>

          <div className="my-4 h-px bg-[var(--surface-border)]" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">الإجمالي</span>
            <span className="tabular text-xl font-semibold text-[var(--accent)]">
              {money(order.total)}
            </span>
          </div>

          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ??
              order.paymentMethod}
          </p>
        </section>

        {/* ── بيانات التوصيل ── */}
        <section className="surface-card p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">بيانات التوصيل</h2>

          <dl className="space-y-3 text-sm">
            <InfoRow label="الاسم">{order.customerName}</InfoRow>
            <InfoRow label="الهاتف">
              <span className="tabular" dir="ltr">
                {formatPhone(order.customerPhone)}
              </span>
            </InfoRow>
            <InfoRow label="المدينة">
              {order.cityName}
              {order.areaName ? ` — ${order.areaName}` : ''}
            </InfoRow>
            <InfoRow label="العنوان">{order.addressLine}</InfoRow>
            {order.notes ? (
              <InfoRow label="ملاحظات">{order.notes}</InfoRow>
            ) : null}
          </dl>
        </section>
      </div>

      {/* ── حالة الطلب ── */}
      <aside className="surface-card p-5 sm:p-6">
        <h2 className="mb-1 text-base font-semibold">حالة الطلب</h2>
        <p className="mb-5 text-xs text-[var(--text-muted)]">
          أُنشئ في {formatDate(order.createdAt, 'datetime')}
        </p>

        <OrderStatusTimeline
          status={validStatus}
          history={order.statusHistory}
        />

        {!TERMINAL_STATUSES.includes(validStatus) ? (
          <p className="mt-6 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            سنتواصل معك هاتفيًا لتأكيد الطلب قبل الشحن.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'success';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd
        className={cn(
          'tabular text-end',
          tone === 'success' && 'text-[var(--color-success)]',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="text-end text-sm">{children}</dd>
    </div>
  );
}
