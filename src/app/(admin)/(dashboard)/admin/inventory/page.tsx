import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageAccess, hasPermission } from '@/lib/auth';
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
import { StockEditor } from '@/components/admin/StockEditor';
import { INVENTORY_REASON_LABELS, type InventoryReason } from '@/lib/constants';
import { formatDate, timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'المخزون',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * إدارة المخزون.
 *
 * تعرض كل الأحجام مع تعديل مباشر، وسجل الحركات الأخير. الترتيب الافتراضي
 * بالأقل مخزونًا — لأن ما يحتاج تدخّل المدير هو ما قارب على النفاد، لا ما
 * كان وفيرًا.
 */
export default async function AdminInventoryPage({ searchParams }: PageProps) {
  const admin = await requirePageAccess('inventory.view');
  const canManage = hasPermission(admin, 'inventory.manage');

  const params = await searchParams;
  const raw = params.filter;
  const filter = Array.isArray(raw) ? raw[0] : raw;

  const [variants, movements, settings] = await Promise.all([
    prisma.productVariant.findMany({
      where: { product: {} },
      orderBy: [{ stock: 'asc' }],
      take: 300,
      select: {
        id: true,
        label: true,
        stock: true,
        lowStockThreshold: true,
        price: true,
        isActive: true,
        product: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        delta: true,
        reason: true,
        stockAfter: true,
        note: true,
        createdAt: true,
        variant: {
          select: { label: true, product: { select: { name: true } } },
        },
        admin: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    getSettings(),
  ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  const filtered = variants.filter((variant) => {
    if (filter === 'out') return variant.stock <= 0;
    if (filter === 'low') {
      return variant.stock > 0 && variant.stock <= variant.lowStockThreshold;
    }
    return true;
  });

  const outCount = variants.filter((v) => v.stock <= 0).length;
  const lowCount = variants.filter(
    (v) => v.stock > 0 && v.stock <= v.lowStockThreshold,
  ).length;

  return (
    <div className="space-y-5">
      {/* ═══════════ التصفية ═══════════ */}
      <nav
        aria-label="تصفية المخزون"
        className="flex flex-wrap gap-2"
      >
        <FilterLink href="/admin/inventory" active={!filter}>
          الكل ({variants.length})
        </FilterLink>
        <FilterLink href="/admin/inventory?filter=low" active={filter === 'low'}>
          مخزون منخفض ({lowCount})
        </FilterLink>
        <FilterLink href="/admin/inventory?filter=out" active={filter === 'out'}>
          نفد ({outCount})
        </FilterLink>
      </nav>

      {/* ═══════════ الجدول ═══════════ */}
      <TableWrap>
        {filtered.length === 0 ? (
          <PanelEmpty message="لا توجد أحجام مطابقة" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>المنتج</Th>
                <Th>الحجم</Th>
                <Th>السعر</Th>
                <Th>حد التنبيه</Th>
                <Th>المخزون</Th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((variant) => (
                <tr
                  key={variant.id}
                  className="transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <Td>
                    <Link
                      href={`/admin/products/${variant.product.id}`}
                      className="font-medium underline-offset-4 hover:text-[var(--accent)] hover:underline"
                    >
                      {variant.product.name}
                    </Link>
                    {!variant.product.isActive ? (
                      <span className="ms-2 text-xs text-[var(--text-muted)]">
                        (مخفي)
                      </span>
                    ) : null}
                  </Td>

                  <Td className="text-[var(--text-secondary)]">
                    {variant.label}
                    {!variant.isActive ? (
                      <span className="ms-2 text-xs text-[var(--text-muted)]">
                        (معطّل)
                      </span>
                    ) : null}
                  </Td>

                  <Td className="tabular">
                    {formatCurrency(variant.price, currency)}
                  </Td>

                  <Td className="tabular text-[var(--text-muted)]">
                    {variant.lowStockThreshold}
                  </Td>

                  <Td>
                    <StockEditor
                      variantId={variant.id}
                      stock={variant.stock}
                      threshold={variant.lowStockThreshold}
                      canManage={canManage}
                      label={`${variant.product.name} — ${variant.label}`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>

      {/* ═══════════ سجل الحركات ═══════════ */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">آخر حركات المخزون</h2>

        <TableWrap>
          {movements.length === 0 ? (
            <PanelEmpty message="لا توجد حركات بعد" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>المنتج</Th>
                  <Th>السبب</Th>
                  <Th>التغيير</Th>
                  <Th>الرصيد بعدها</Th>
                  <Th>المصدر</Th>
                  <Th>الوقت</Th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <Td>
                      <span className="block text-sm">
                        {movement.variant.product.name}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {movement.variant.label}
                      </span>
                    </Td>

                    <Td className="text-[var(--text-secondary)]">
                      {INVENTORY_REASON_LABELS[
                        movement.reason as InventoryReason
                      ] ?? movement.reason}
                    </Td>

                    <Td>
                      <span
                        className={cn(
                          'tabular font-semibold',
                          movement.delta > 0
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-danger)]',
                        )}
                      >
                        {movement.delta > 0 ? '+' : ''}
                        {movement.delta}
                      </span>
                    </Td>

                    <Td className="tabular">{movement.stockAfter}</Td>

                    <Td className="text-xs text-[var(--text-secondary)]">
                      {movement.order ? (
                        <Link
                          href={`/admin/orders/${movement.order.id}`}
                          className="tabular text-[var(--accent)] underline-offset-4 hover:underline"
                        >
                          {movement.order.orderNumber}
                        </Link>
                      ) : (
                        (movement.admin?.name ?? movement.note ?? 'النظام')
                      )}
                    </Td>

                    <Td
                      className="whitespace-nowrap text-xs text-[var(--text-muted)]"
                      title={formatDate(movement.createdAt, 'datetime')}
                    >
                      {timeAgo(movement.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </TableWrap>
      </section>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-4 py-2 text-xs transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]',
      )}
    >
      {children}
    </Link>
  );
}
