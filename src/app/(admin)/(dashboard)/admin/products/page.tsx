import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Search, Package, Eye, EyeOff } from 'lucide-react';
import { requirePageAccess, hasPermission } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import {
  queryAdminProducts,
  getProductFormOptions,
} from '@/lib/services/admin-products';
import {
  TableWrap,
  Table,
  Th,
  Td,
  PanelEmpty,
  formatCurrency,
} from '@/components/admin/ui';
import { ProductRowActions } from '@/components/admin/ProductRowActions';
import { Pagination } from '@/components/product/Pagination';
import { GENDER_LABELS, stockLevelOf, type Gender } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'المنتجات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const admin = await requirePageAccess('products.view');
  const canManage = hasPermission(admin, 'products.manage');

  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pageRaw = Number(one('page'));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [settings, result, { categories }] = await Promise.all([
    getSettings(),
    queryAdminProducts({
      search: one('q')?.trim().slice(0, 60),
      status: one('status'),
      categoryId: one('category'),
      page,
    }),
    getProductFormOptions(),
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

    const query = next.toString();
    return query ? `/admin/products?${query}` : '/admin/products';
  }

  return (
    <div className="space-y-5">
      {/* ═══════════ الترويسة ═══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {result.total}
          </span>{' '}
          منتج
        </p>

        {canManage ? (
          <Link
            href="/admin/products/new"
            className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} aria-hidden />
            منتج جديد
          </Link>
        ) : null}
      </div>

      {/* ═══════════ التصفية ═══════════ */}
      <form
        method="get"
        action="/admin/products"
        className="surface-card flex flex-wrap items-end gap-3 p-4"
      >
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
              defaultValue={one('q') ?? ''}
              placeholder="اسم المنتج أو العطر المستوحى منه"
              className="h-11 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            الحالة
          </label>
          <select
            id="status"
            name="status"
            defaultValue={one('status') ?? ''}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">الكل</option>
            <option value="active">منشور</option>
            <option value="hidden">مخفي</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="category"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            التصنيف
          </label>
          <select
            id="category"
            name="category"
            defaultValue={one('category') ?? ''}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">كل التصنيفات</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="tap-target rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          تطبيق
        </button>
      </form>

      {/* ═══════════ الجدول ═══════════ */}
      <TableWrap>
        {result.products.length === 0 ? (
          <PanelEmpty message="لا توجد منتجات مطابقة" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>المنتج</Th>
                <Th>التصنيف</Th>
                <Th>الأحجام</Th>
                <Th>السعر</Th>
                <Th>المخزون</Th>
                <Th>الحالة</Th>
                <Th className="text-end">إجراءات</Th>
              </tr>
            </thead>

            <tbody>
              {result.products.map((product) => {
                const active = product.variants.filter((v) => v.isActive);
                const prices = active.map((v) => v.price);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const totalStock = active.reduce((sum, v) => sum + v.stock, 0);
                const level = stockLevelOf(totalStock, 5);

                return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                          {product.images[0] ? (
                            <Image
                              src={product.images[0].url}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-full w-full items-center justify-center text-[var(--text-muted)]/40"
                              aria-hidden
                            >
                              <Package size={14} />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="line-clamp-1 font-medium underline-offset-4 hover:text-[var(--accent)] hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-[var(--text-muted)]">
                            {GENDER_LABELS[product.gender as Gender] ?? ''}
                            {product.isFeatured ? ' · مختار' : ''}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td className="text-[var(--text-secondary)]">
                      {product.category?.name ?? '—'}
                    </Td>

                    <Td className="tabular text-[var(--text-secondary)]">
                      {active.length}
                    </Td>

                    <Td className="tabular font-medium">
                      {prices.length > 0 ? formatCurrency(minPrice, currency) : '—'}
                    </Td>

                    <Td>
                      <span
                        className={cn(
                          'tabular rounded-full px-2.5 py-1 text-xs font-semibold',
                          level === 'out_of_stock' &&
                            'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
                          level === 'low_stock' &&
                            'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
                          level === 'in_stock' &&
                            'bg-[var(--color-success)]/15 text-[var(--color-success)]',
                        )}
                      >
                        {totalStock}
                      </span>
                    </Td>

                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          product.isActive
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--text-muted)]',
                        )}
                      >
                        {product.isActive ? (
                          <Eye size={13} aria-hidden />
                        ) : (
                          <EyeOff size={13} aria-hidden />
                        )}
                        {product.isActive ? 'منشور' : 'مخفي'}
                      </span>
                    </Td>

                    <Td className="text-end">
                      <ProductRowActions
                        productId={product.id}
                        productName={product.name}
                        slug={product.slug}
                        isActive={product.isActive}
                        canManage={canManage}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableWrap>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(target) => hrefWith({ page: String(target) })}
      />
    </div>
  );
}
