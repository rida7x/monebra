import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Wallet,
  ShoppingCart,
  Users,
  Package,
  TriangleAlert,
  CircleCheck,
  CircleX,
  TrendingUp,
} from 'lucide-react';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  getDashboardStats,
  getSalesSeries,
  SALES_RANGES,
  isSalesRange,
  getTopProducts,
  getTopCities,
  getRecentOrders,
  getLowStockVariants,
} from '@/lib/services/admin-stats';
import {
  StatCard,
  StatusBadge,
  TableWrap,
  Table,
  Th,
  Td,
  PanelHeading,
  PanelEmpty,
  formatCurrency,
} from '@/components/admin/ui';
import { SalesChart } from '@/components/admin/SalesChart';
import { formatDate, timeAgo } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'لوحة المعلومات',
  robots: { index: false, follow: false },
};

/** بيانات اللوحة لحظية دائمًا — لا معنى لعرض مبيعات مخزّنة مؤقتًا */
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePageAccess('dashboard.view');

  // النطاق في الرابط لا في حالة العميل: الصفحة تُرسم على الخادم، والرابط
  // يبقى قابلًا للمشاركة والعودة إليه
  const { range: rawRange } = await searchParams;
  const range = isSalesRange(rawRange) ? rawRange : 'month';

  const [settings, stats, sales, topProducts, topCities, recentOrders, lowStock] =
    await Promise.all([
      getSettings(),
      getDashboardStats(),
      getSalesSeries(range),
      getTopProducts(5),
      getTopCities(5),
      getRecentOrders(8),
      getLowStockVariants(6),
    ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  const money = (minor: number) => formatCurrency(minor, currency);

  return (
    <div className="space-y-6">
      {/* ═══════════ الأرقام الرئيسية ═══════════ */}
      <section
        aria-label="ملخّص الأرقام"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="إجمالي المبيعات"
          value={money(stats.revenueTotal)}
          hint="لا يشمل الملغي والمرتجع"
          icon={<Wallet size={18} />}
          tone="accent"
        />
        <StatCard
          label="المبيعات المسلَّمة"
          value={money(stats.revenueDelivered)}
          hint="طلبات وصلت للعميل"
          icon={<CircleCheck size={18} />}
          tone="success"
        />
        <StatCard
          label="متوسط قيمة الطلب"
          value={money(stats.averageOrderValue)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="طلبات جديدة"
          value={String(stats.ordersNew)}
          hint={stats.ordersNew > 0 ? 'بانتظار التأكيد' : 'لا شيء جديد'}
          icon={<ShoppingCart size={18} />}
          tone={stats.ordersNew > 0 ? 'warning' : 'neutral'}
          href="/admin/orders?status=new"
        />
      </section>

      <section
        aria-label="أرقام إضافية"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="إجمالي الطلبات"
          value={String(stats.ordersTotal)}
          icon={<ShoppingCart size={18} />}
          href="/admin/orders"
        />
        <StatCard
          label="الطلبات المكتملة"
          value={String(stats.ordersDelivered)}
          icon={<CircleCheck size={18} />}
          tone="success"
          href="/admin/orders?status=delivered"
        />
        <StatCard
          label="الملغاة والمرتجعة"
          value={String(stats.ordersCancelled)}
          icon={<CircleX size={18} />}
          tone={stats.ordersCancelled > 0 ? 'danger' : 'neutral'}
          href="/admin/orders?status=cancelled"
        />
        <StatCard
          label="العملاء"
          value={String(stats.customersTotal)}
          icon={<Users size={18} />}
          href="/admin/customers"
        />
      </section>

      {/* ═══════════ تنبيه المخزون ═══════════ */}
      {stats.outOfStockCount + stats.lowStockCount > 0 ? (
        <Link
          href="/admin/inventory"
          className="flex items-start gap-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 p-4 transition-colors hover:border-[var(--color-warning)]"
        >
          <TriangleAlert
            size={19}
            className="mt-0.5 shrink-0 text-[var(--color-warning)]"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-warning)]">
              يحتاج المخزون انتباهك
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {stats.outOfStockCount > 0
                ? `${stats.outOfStockCount} حجم نفد بالكامل`
                : ''}
              {stats.outOfStockCount > 0 && stats.lowStockCount > 0 ? ' · ' : ''}
              {stats.lowStockCount > 0
                ? `${stats.lowStockCount} حجم قارب على النفاد`
                : ''}
            </p>
          </div>
        </Link>
      ) : null}

      {/* ═══════════ منحنى المبيعات ═══════════ */}
      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">المبيعات</h2>

          <div
            className="flex flex-wrap gap-1 rounded-lg bg-[var(--surface-sunken)] p-1"
            role="group"
            aria-label="نطاق المبيعات"
          >
            {(
              Object.entries(SALES_RANGES) as [
                keyof typeof SALES_RANGES,
                { label: string },
              ][]
            ).map(([key, config]) => (
              <Link
                key={key}
                href={key === 'month' ? '/admin' : `/admin?range=${key}`}
                scroll={false}
                aria-current={key === range ? 'true' : undefined}
                className={
                  key === range
                    ? 'rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)]'
                    : 'rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
                }
              >
                {config.label}
              </Link>
            ))}
          </div>
        </div>

        <SalesChart data={sales} currency={currency} />
      </section>

      {/* ═══════════ آخر الطلبات ═══════════ */}
      <section>
        <PanelHeading
          title="آخر الطلبات"
          action={{ href: '/admin/orders', label: 'عرض الكل' }}
        />

        <TableWrap>
          {recentOrders.length === 0 ? (
            <PanelEmpty message="لا توجد طلبات بعد" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>رقم الطلب</Th>
                  <Th>العميل</Th>
                  <Th>المدينة</Th>
                  <Th>الأصناف</Th>
                  <Th>الإجمالي</Th>
                  <Th>الحالة</Th>
                  <Th>الوقت</Th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="tabular font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td className="max-w-[12rem] truncate">
                      {order.customerName}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">
                      {order.cityName}
                    </Td>
                    <Td className="tabular text-[var(--text-secondary)]">
                      {order._count.items}
                    </Td>
                    <Td className="tabular font-semibold">
                      {money(order.total)}
                    </Td>
                    <Td>
                      <StatusBadge status={order.status} />
                    </Td>
                    <Td
                      className="whitespace-nowrap text-xs text-[var(--text-muted)]"
                      title={formatDate(order.createdAt, 'datetime')}
                    >
                      {timeAgo(order.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </TableWrap>
      </section>

      {/* ═══════════ الأكثر مبيعًا / المدن / المخزون ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface-card p-4 sm:p-5">
          <PanelHeading title="الأكثر مبيعًا" />

          {topProducts.length === 0 ? (
            <PanelEmpty message="لا مبيعات بعد" />
          ) : (
            <ul className="space-y-3">
              {topProducts.map((product, index) => (
                <li
                  key={product.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-xs font-semibold text-[var(--text-muted)]"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-sm">{product.name}</span>
                  </span>

                  <span className="tabular shrink-0 text-xs text-[var(--text-muted)]">
                    {product.quantity} قطعة
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-4 sm:p-5">
          <PanelHeading title="أكثر المدن طلبًا" />

          {topCities.length === 0 ? (
            <PanelEmpty message="لا طلبات بعد" />
          ) : (
            <ul className="space-y-3">
              {topCities.map((city) => (
                <li
                  key={city.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-sm">{city.name}</span>
                  <span className="tabular shrink-0 text-xs text-[var(--text-muted)]">
                    {city.orders} طلب · {money(city.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-4 sm:p-5">
          <PanelHeading
            title="مخزون منخفض"
            action={{ href: '/admin/inventory', label: 'إدارة' }}
          />

          {lowStock.length === 0 ? (
            <PanelEmpty message="كل الأحجام ضمن الحد الآمن" />
          ) : (
            <ul className="space-y-3">
              {lowStock.map((variant) => (
                <li
                  key={variant.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {variant.product.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {variant.label}
                    </span>
                  </span>

                  <span
                    className={`tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      variant.stock === 0
                        ? 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]'
                        : 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                    }`}
                  >
                    {variant.stock === 0 ? 'نفد' : variant.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ═══════════ المنتجات ═══════════ */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="المنتجات المنشورة"
          value={String(stats.productsTotal - stats.productsHidden)}
          icon={<Package size={18} />}
          href="/admin/products"
        />
        <StatCard
          label="المنتجات المخفية"
          value={String(stats.productsHidden)}
          icon={<Package size={18} />}
          href="/admin/products?status=hidden"
        />
        <StatCard
          label="أحجام نفدت"
          value={String(stats.outOfStockCount)}
          tone={stats.outOfStockCount > 0 ? 'danger' : 'neutral'}
          icon={<CircleX size={18} />}
          href="/admin/inventory?filter=out"
        />
        <StatCard
          label="أحجام قاربت النفاد"
          value={String(stats.lowStockCount)}
          tone={stats.lowStockCount > 0 ? 'warning' : 'neutral'}
          icon={<TriangleAlert size={18} />}
          href="/admin/inventory?filter=low"
        />
      </section>
    </div>
  );
}
