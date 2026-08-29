import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  ArrowRight,
  Phone,
  MapPin,
  Printer,
  Package,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react';
import { requirePageAccess, hasPermission } from '@/lib/auth';
import { getSettings, whatsappLink } from '@/lib/settings';
import { getAdminOrder } from '@/lib/services/admin-orders';
import {
  StatusBadge,
  PanelHeading,
  formatCurrency,
} from '@/components/admin/ui';
import { OrderStatusControl } from '@/components/admin/OrderStatusControl';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';
import { formatDate, formatPhone } from '@/lib/utils';

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
    title: `الطلب ${order.orderNumber}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminOrderPage({ params }: PageProps) {
  const admin = await requirePageAccess('orders.view');
  const { id } = await params;

  const order = await loadOrder(id);
  if (!order) notFound();

  const settings = await getSettings();
  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };
  const money = (minor: number) => formatCurrency(minor, currency);

  const canManage = hasPermission(admin, 'orders.manage');

  // رسالة واتساب جاهزة للعميل — توفّر على الموظف كتابتها في كل مرة
  const whatsapp = whatsappLink(
    order.customerPhone,
    `مرحبًا ${order.customerName}، بخصوص طلبك ${order.orderNumber} من ${settings.storeName}.`,
  );

  const DeviceIcon =
    order.deviceType === 'mobile'
      ? Smartphone
      : order.deviceType === 'tablet'
        ? Tablet
        : Monitor;

  return (
    <div className="space-y-5">
      {/* ═══════════ الترويسة ═══════════ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/orders"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
          >
            <ArrowRight size={13} aria-hidden />
            كل الطلبات
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="tabular text-2xl font-bold text-[var(--accent)]">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>

          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {formatDate(order.createdAt, 'datetime')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target inline-flex items-center gap-2 rounded-lg border border-[#25D366]/50 px-4 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white"
            >
              <WhatsAppIcon size={15} />
              واتساب العميل
            </a>
          ) : null}

          <a
            href={`/admin/orders/${order.id}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--surface-border-strong)] px-4 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Printer size={15} aria-hidden />
            الفاتورة
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          {/* ═══════════ الأصناف ═══════════ */}
          <section className="surface-card p-4 sm:p-5">
            <PanelHeading title={`الأصناف (${order.items.length})`} />

            <ul className="space-y-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[var(--text-muted)]/40"
                        aria-hidden
                      >
                        <Package size={16} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {item.productSlug ? (
                      <Link
                        href={`/product/${item.productSlug}`}
                        target="_blank"
                        className="line-clamp-1 text-sm font-medium underline-offset-4 hover:text-[var(--accent)] hover:underline"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="line-clamp-1 text-sm font-medium">
                        {item.productName}
                      </p>
                    )}

                    <p className="tabular mt-0.5 text-xs text-[var(--text-muted)]">
                      {item.variantLabel} · {money(item.unitPrice)} ×{' '}
                      {item.quantity}
                    </p>
                  </div>

                  <span className="tabular shrink-0 text-sm font-semibold">
                    {money(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-4 h-px bg-[var(--surface-border)]" />

            <dl className="space-y-2 text-sm">
              <Row label="المجموع">{money(order.subtotal)}</Row>

              {order.discountTotal > 0 ? (
                <Row
                  label={`الخصم${order.couponCode ? ` · ${order.couponCode}` : ''}`}
                  tone="success"
                >
                  − {money(order.discountTotal)}
                </Row>
              ) : null}

              <Row label="التوصيل">
                {order.deliveryFee === 0 ? 'مجاني' : money(order.deliveryFee)}
              </Row>
            </dl>

            <div className="my-3 h-px bg-[var(--surface-border)]" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">الإجمالي</span>
              <span className="tabular text-xl font-bold text-[var(--accent)]">
                {money(order.total)}
              </span>
            </div>

            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ??
                order.paymentMethod}
            </p>
          </section>

          {/* ═══════════ سجل الحالات ═══════════ */}
          <section className="surface-card p-4 sm:p-5">
            <PanelHeading title="سجل الحالات" />

            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                  />

                  <div className="min-w-0 flex-1">
                    <p>
                      {entry.fromStatus ? (
                        <>
                          <span className="text-[var(--text-muted)]">
                            {ORDER_STATUS_LABELS[
                              entry.fromStatus as OrderStatus
                            ] ?? entry.fromStatus}
                          </span>
                          {' ← '}
                        </>
                      ) : null}
                      <span className="font-medium">
                        {ORDER_STATUS_LABELS[entry.toStatus as OrderStatus] ??
                          entry.toStatus}
                      </span>
                    </p>

                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {formatDate(entry.createdAt, 'datetime')}
                      {entry.admin ? ` · ${entry.admin.name}` : ' · المتجر'}
                    </p>

                    {entry.note ? (
                      <p className="mt-1 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ═══════════ العمود الجانبي ═══════════ */}
        <div className="space-y-5">
          <section className="surface-card p-4 sm:p-5">
            <PanelHeading title="تغيير الحالة" />
            <OrderStatusControl
              orderId={order.id}
              currentStatus={order.status as OrderStatus}
              canManage={canManage}
            />
          </section>

          <section className="surface-card p-4 sm:p-5">
            <PanelHeading title="بيانات العميل" />

            <dl className="space-y-3 text-sm">
              <InfoRow label="الاسم">{order.customerName}</InfoRow>

              <InfoRow label="الهاتف">
                <a
                  href={`tel:${order.customerPhone}`}
                  dir="ltr"
                  className="tabular inline-flex items-center gap-1.5 transition-colors hover:text-[var(--accent)]"
                >
                  <Phone size={12} aria-hidden />
                  {formatPhone(order.customerPhone)}
                </a>
              </InfoRow>

              <InfoRow label="الوجهة">
                <span className="inline-flex items-start gap-1.5">
                  <MapPin size={12} className="mt-1 shrink-0" aria-hidden />
                  <span>
                    {order.cityName}
                    {order.areaName ? ` — ${order.areaName}` : ''}
                  </span>
                </span>
              </InfoRow>

              <InfoRow label="العنوان">{order.addressLine}</InfoRow>

              {order.notes ? (
                <InfoRow label="ملاحظات">
                  <span className="block rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs">
                    {order.notes}
                  </span>
                </InfoRow>
              ) : null}

              {order.customer ? (
                <InfoRow label="سجل العميل">
                  <Link
                    href={`/admin/customers/${order.customer.id}`}
                    className="tabular text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    {order.customer.ordersCount} طلب ·{' '}
                    {money(order.customer.totalSpent)}
                  </Link>
                </InfoRow>
              ) : null}
            </dl>
          </section>

          <section className="surface-card p-4 sm:p-5">
            <PanelHeading title="معلومات فنية" />

            <dl className="space-y-3 text-sm">
              <InfoRow label="الجهاز">
                <span className="inline-flex items-center gap-1.5">
                  <DeviceIcon size={13} aria-hidden />
                  {order.deviceType === 'mobile'
                    ? 'هاتف'
                    : order.deviceType === 'tablet'
                      ? 'جهاز لوحي'
                      : order.deviceType === 'desktop'
                        ? 'كمبيوتر'
                        : 'غير معروف'}
                </span>
              </InfoRow>

              <InfoRow label="المخزون">
                {order.stockRestored
                  ? 'أُعيد إلى المخزون'
                  : order.stockApplied
                    ? 'مخصوم من المخزون'
                    : 'لم يُخصم'}
              </InfoRow>

              {order.confirmedAt ? (
                <InfoRow label="تاريخ التأكيد">
                  {formatDate(order.confirmedAt, 'datetime')}
                </InfoRow>
              ) : null}

              {order.deliveredAt ? (
                <InfoRow label="تاريخ التسليم">
                  {formatDate(order.deliveredAt, 'datetime')}
                </InfoRow>
              ) : null}

              {order.cancelledAt ? (
                <InfoRow label="تاريخ الإلغاء">
                  {formatDate(order.cancelledAt, 'datetime')}
                </InfoRow>
              ) : null}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
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
        className={`tabular text-end ${
          tone === 'success' ? 'text-[var(--color-success)]' : ''
        }`}
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
    <div>
      <dt className="mb-1 text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
