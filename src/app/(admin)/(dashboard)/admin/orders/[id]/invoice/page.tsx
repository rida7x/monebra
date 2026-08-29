import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getAdminOrder } from '@/lib/services/admin-orders';
import { formatMoney } from '@/lib/money';
import { formatDate, formatPhone } from '@/lib/utils';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';
import { PrintButton } from '@/components/admin/PrintButton';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

const loadOrder = cache(async (id: string) => getAdminOrder(id));

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await loadOrder(id);

  if (!order) notFound();

  return {
    title: `فاتورة ${order.orderNumber}`,
    robots: { index: false, follow: false },
  };
}

/**
 * الفاتورة القابلة للطباعة.
 *
 * قواعد الطباعة (في globals.css تحت `@media print`):
 *  • يُخفى الشريط الجانبي ورأس اللوحة وكل زر — تُطبع الفاتورة وحدها
 *  • الخلفية بيضاء والنص أسود مهما كان وضع الشاشة، لتوفير الحبر ولضمان
 *    الوضوح على الطابعات أحادية اللون
 *  • عرض A4 مع هوامش مناسبة، والجدول لا يُقطع عبر الصفحات
 */
export default async function InvoicePage({ params }: PageProps) {
  await requirePageAccess('orders.view');

  const { id } = await params;
  const order = await loadOrder(id);
  if (!order) notFound();

  const settings = await getSettings();

  const money = (minor: number) =>
    formatMoney(minor, {
      currency: settings.currencySymbol,
      decimals: settings.currencyDecimals,
    });

  return (
    <div className="mx-auto max-w-[21cm] print:max-w-none">
      <div className="mb-5 flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <article className="invoice-sheet surface-card p-8 print:border-0 print:p-0 print:shadow-none">
        {/* ═══════════ الترويسة ═══════════ */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[var(--accent)] pb-6">
          <div>
            <p className="font-display text-2xl font-semibold text-[var(--accent)]">
              {settings.storeName}
            </p>

            {settings.storeTagline ? (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {settings.storeTagline}
              </p>
            ) : null}

            <div className="mt-3 space-y-0.5 text-xs text-[var(--text-secondary)]">
              {settings.phonePrimary ? (
                <p dir="ltr" className="tabular text-start">
                  {formatPhone(settings.phonePrimary)}
                </p>
              ) : null}
              {settings.addressText ? <p>{settings.addressText}</p> : null}
            </div>
          </div>

          <div className="text-end">
            <p className="text-sm font-semibold">فاتورة</p>
            <p className="tabular mt-1 text-xl font-bold text-[var(--accent)]">
              {order.orderNumber}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {formatDate(order.createdAt, 'datetime')}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              الحالة: {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
            </p>
          </div>
        </header>

        {/* ═══════════ بيانات العميل ═══════════ */}
        <section className="grid gap-6 border-b border-[var(--surface-border)] py-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
              بيانات العميل
            </p>
            <p className="text-sm font-medium">{order.customerName}</p>
            <p dir="ltr" className="tabular mt-1 text-start text-sm">
              {formatPhone(order.customerPhone)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
              عنوان التوصيل
            </p>
            <p className="text-sm">
              {order.cityName}
              {order.areaName ? ` — ${order.areaName}` : ''}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{order.addressLine}</p>
            {order.notes ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                ملاحظات: {order.notes}
              </p>
            ) : null}
          </div>
        </section>

        {/* ═══════════ الأصناف ═══════════ */}
        <section className="py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--surface-border)]">
                <th scope="col" className="pb-2 text-start text-xs font-semibold text-[var(--text-muted)]">
                  الصنف
                </th>
                <th scope="col" className="pb-2 text-start text-xs font-semibold text-[var(--text-muted)]">
                  الحجم
                </th>
                <th scope="col" className="pb-2 text-end text-xs font-semibold text-[var(--text-muted)]">
                  السعر
                </th>
                <th scope="col" className="pb-2 text-center text-xs font-semibold text-[var(--text-muted)]">
                  الكمية
                </th>
                <th scope="col" className="pb-2 text-end text-xs font-semibold text-[var(--text-muted)]">
                  الإجمالي
                </th>
              </tr>
            </thead>

            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--surface-border)]"
                >
                  <td className="py-3">{item.productName}</td>
                  <td className="py-3 text-[var(--text-secondary)]">
                    {item.variantLabel}
                  </td>
                  <td className="tabular py-3 text-end">
                    {money(item.unitPrice)}
                  </td>
                  <td className="tabular py-3 text-center">{item.quantity}</td>
                  <td className="tabular py-3 text-end font-medium">
                    {money(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ═══════════ الإجماليات ═══════════ */}
        <section className="flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">المجموع</dt>
              <dd className="tabular">{money(order.subtotal)}</dd>
            </div>

            {order.discountTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">
                  الخصم{order.couponCode ? ` (${order.couponCode})` : ''}
                </dt>
                <dd className="tabular">− {money(order.discountTotal)}</dd>
              </div>
            ) : null}

            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">التوصيل</dt>
              <dd className="tabular">
                {order.deliveryFee === 0 ? 'مجاني' : money(order.deliveryFee)}
              </dd>
            </div>

            <div className="mt-2 flex justify-between border-t-2 border-[var(--accent)] pt-3">
              <dt className="text-base font-bold">الإجمالي النهائي</dt>
              <dd className="tabular text-base font-bold text-[var(--accent)]">
                {money(order.total)}
              </dd>
            </div>

            <p className="pt-1 text-xs text-[var(--text-secondary)]">
              {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ??
                order.paymentMethod}
            </p>
          </dl>
        </section>

        {/* ═══════════ التذييل ═══════════ */}
        <footer className="mt-8 border-t border-[var(--surface-border)] pt-5 text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            شكرًا لثقتك بـ {settings.storeName}
          </p>

          {settings.whatsappNumber ? (
            <p dir="ltr" className="tabular mt-1 text-xs text-[var(--text-muted)]">
              {formatPhone(settings.whatsappNumber)}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
