import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Phone } from 'lucide-react';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  parseOrderFilters,
  queryOrders,
  getOrderCities,
} from '@/lib/services/admin-orders';
import {
  StatusBadge,
  TableWrap,
  Table,
  Th,
  Td,
  PanelEmpty,
  formatCurrency,
} from '@/components/admin/ui';
import { Pagination } from '@/components/product/Pagination';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatPhone, timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'الطلبات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * قائمة الطلبات.
 *
 * التصفية كلها في الـ URL: الرابط قابل للحفظ والمشاركة بين الموظفين
 * («افتح لي طلبات بنغازي غير المؤكدة»)، وزر الرجوع يعمل كما يتوقعون.
 */
export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requirePageAccess('orders.view');

  const params = await searchParams;
  const filters = parseOrderFilters(params);

  const [settings, result, cities] = await Promise.all([
    getSettings(),
    queryOrders(filters),
    getOrderCities(),
  ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  function hrefWith(changes: Record<string, string | undefined>): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      next.set(key, Array.isArray(value) ? value[0]! : value);
    }

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }

    // أي تغيير في التصفية يعيدنا للصفحة الأولى
    if (!('page' in changes)) next.delete('page');

    const query = next.toString();
    return query ? `/admin/orders?${query}` : '/admin/orders';
  }

  return (
    <div className="space-y-5">
      {/* ═══════════ التصفية بالحالة ═══════════ */}
      <nav
        aria-label="تصفية بالحالة"
        className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        <FilterChip
          href={hrefWith({ status: undefined })}
          active={!filters.status}
          count={Object.values(result.statusCounts).reduce((a, b) => a + b, 0)}
        >
          الكل
        </FilterChip>

        {ORDER_STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={hrefWith({ status })}
            active={filters.status === status}
            count={result.statusCounts[status] ?? 0}
          >
            {ORDER_STATUS_LABELS[status]}
          </FilterChip>
        ))}
      </nav>

      {/* ═══════════ البحث والتصفية ═══════════ */}
      <form
        method="get"
        action="/admin/orders"
        className="surface-card flex flex-wrap items-end gap-3 p-4"
      >
        {filters.status ? (
          <input type="hidden" name="status" value={filters.status} />
        ) : null}

        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            بحث
          </label>
          <div className="relative">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              id="q"
              name="q"
              defaultValue={filters.search ?? ''}
              placeholder="رقم الطلب أو اسم العميل أو هاتفه"
              className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="city"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            المدينة
          </label>
          <select
            id="city"
            name="city"
            defaultValue={filters.cityId ?? ''}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">كل المدن</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="from"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            من تاريخ
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={params.from as string | undefined}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="to"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            إلى تاريخ
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={params.to as string | undefined}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          type="submit"
          className="tap-target rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          تطبيق
        </button>

        {filters.search || filters.cityId || params.from || params.to ? (
          <Link
            href={filters.status ? `/admin/orders?status=${filters.status}` : '/admin/orders'}
            className="tap-target flex items-center rounded-lg border border-[var(--surface-border)] px-4 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          >
            مسح
          </Link>
        ) : null}
      </form>

      {/* ═══════════ الجدول ═══════════ */}
      <p className="text-sm text-[var(--text-secondary)]">
        <span className="tabular font-semibold text-[var(--text-primary)]">
          {result.total}
        </span>{' '}
        طلب
      </p>

      <TableWrap>
        {result.orders.length === 0 ? (
          <PanelEmpty message="لا توجد طلبات مطابقة" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>رقم الطلب</Th>
                <Th>العميل</Th>
                <Th>الهاتف</Th>
                <Th>الوجهة</Th>
                <Th>الأصناف</Th>
                <Th>الإجمالي</Th>
                <Th>الحالة</Th>
                <Th>التاريخ</Th>
              </tr>
            </thead>

            <tbody>
              {result.orders.map((order) => (
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

                  <Td>
                    <a
                      href={`tel:${order.customerPhone}`}
                      dir="ltr"
                      className="tabular inline-flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
                    >
                      <Phone size={12} aria-hidden />
                      {formatPhone(order.customerPhone)}
                    </a>
                  </Td>

                  <Td className="text-[var(--text-secondary)]">
                    {order.cityName}
                    {order.areaName ? (
                      <span className="text-[var(--text-muted)]">
                        {' '}
                        — {order.areaName}
                      </span>
                    ) : null}
                  </Td>

                  <Td className="tabular text-[var(--text-secondary)]">
                    {order._count.items}
                  </Td>

                  <Td className="tabular font-semibold">
                    {formatCurrency(order.total, currency)}
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

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(page) => hrefWith({ page: String(page) })}
      />
    </div>
  );
}

function FilterChip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
      <span
        className={cn(
          'tabular rounded-full px-1.5 py-0.5 text-[0.65rem]',
          active
            ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
            : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
        )}
      >
        {count}
      </span>
    </Link>
  );
}
