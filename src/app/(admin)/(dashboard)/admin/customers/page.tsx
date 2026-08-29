import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Phone } from 'lucide-react';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import {
  TableWrap,
  Table,
  Th,
  Td,
  PanelEmpty,
  formatCurrency,
} from '@/components/admin/ui';
import { formatDate, formatPhone, normalizePhone } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'العملاء',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * قائمة العملاء.
 *
 * العميل يُنشأ تلقائيًا عند أول طلب — لا يوجد تسجيل حساب في هذه المرحلة.
 * `ordersCount` و`totalSpent` محدَّثان في نفس معاملة إنشاء الطلب، فلا
 * يحتاجان حسابًا هنا.
 */
export default async function AdminCustomersPage({ searchParams }: PageProps) {
  await requirePageAccess('customers.view');

  const params = await searchParams;
  const raw = params.q;
  const search = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 60);

  const phone = search ? normalizePhone(search) : null;

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: phone ?? search } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        ordersCount: true,
        totalSpent: true,
        createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { cityName: true, createdAt: true },
        },
      },
    }),
    getSettings(),
  ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  return (
    <div className="space-y-5">
      <form
        method="get"
        action="/admin/customers"
        className="surface-card flex flex-wrap items-end gap-3 p-4"
      >
        <div className="min-w-[14rem] flex-1">
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
              defaultValue={search ?? ''}
              placeholder="اسم العميل أو رقم هاتفه"
              className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <button
          type="submit"
          className="tap-target rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          بحث
        </button>
      </form>

      <TableWrap>
        {customers.length === 0 ? (
          <PanelEmpty message="لا يوجد عملاء بعد" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الهاتف</Th>
                <Th>الطلبات</Th>
                <Th>إجمالي الإنفاق</Th>
                <Th>آخر مدينة</Th>
                <Th>أول طلب</Th>
              </tr>
            </thead>

            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <Td className="font-medium">{customer.name}</Td>

                  <Td>
                    <a
                      href={`tel:${customer.phone}`}
                      dir="ltr"
                      className="tabular inline-flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
                    >
                      <Phone size={12} aria-hidden />
                      {formatPhone(customer.phone)}
                    </a>
                  </Td>

                  <Td>
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(customer.phone)}`}
                      className="tabular font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {customer.ordersCount}
                    </Link>
                  </Td>

                  <Td className="tabular font-semibold">
                    {formatCurrency(customer.totalSpent, currency)}
                  </Td>

                  <Td className="text-[var(--text-secondary)]">
                    {customer.orders[0]?.cityName ?? '—'}
                  </Td>

                  <Td className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                    {formatDate(customer.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
    </div>
  );
}
