import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Boxes, Eye, EyeOff } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'الباقات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * قائمة الباقات.
 *
 * الباقة منتج بنوع `bundle`، فتُعدَّل بنفس نموذج المنتج. هذه الصفحة تعرضها
 * منفصلة لأن إدارتها ذهنيًا مختلفة: يهم المدير معرفة ما بداخلها، وهل نفد
 * أحد أصنافها — وهو ما لا يظهره جدول المنتجات العادي.
 */
export default async function AdminBundlesPage() {
  const admin = await requirePageAccess('products.view');
  const canManage = hasPermission(admin, 'products.manage');

  const [bundles, settings] = await Promise.all([
    prisma.product.findMany({
      where: { type: 'bundle' },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { url: true },
        },
        variants: { select: { price: true, stock: true, isActive: true } },
        bundleItems: {
          select: {
            quantity: true,
            itemVariant: {
              select: {
                label: true,
                stock: true,
                product: { select: { name: true } },
              },
            },
          },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {bundles.length}
          </span>{' '}
          باقة
        </p>

        {canManage ? (
          <Link
            href="/admin/bundles/new"
            className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} aria-hidden />
            باقة جديدة
          </Link>
        ) : null}
      </div>

      <p className="rounded-xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/8 p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        الباقة منتج له سعره ومخزونه المستقل، وتظهر أصنافها للعميل في صفحتها.
        المخزون مستقل لأن الباقات تُجهَّز مسبقًا كوحدات جاهزة — لذا تابع
        مخزون أصنافها بنفسك.
      </p>

      <TableWrap>
        {bundles.length === 0 ? (
          <PanelEmpty message="لا توجد باقات بعد. أنشئ باقة لتجميع عدة عطور بسعر مخفّض." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الباقة</Th>
                <Th>تحتوي</Th>
                <Th>السعر</Th>
                <Th>المخزون</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>

            <tbody>
              {bundles.map((bundle) => {
                const active = bundle.variants.filter((v) => v.isActive);
                const prices = active.map((v) => v.price);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const stock = active.reduce((sum, v) => sum + v.stock, 0);

                const emptyItems = bundle.bundleItems.filter(
                  (item) => item.itemVariant.stock <= 0,
                );

                return (
                  <tr
                    key={bundle.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                          {bundle.images[0] ? (
                            <Image
                              src={bundle.images[0].url}
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
                              <Boxes size={15} />
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/admin/products/${bundle.id}`}
                          className="font-medium underline-offset-4 hover:text-[var(--accent)] hover:underline"
                        >
                          {bundle.name}
                        </Link>
                      </div>
                    </Td>

                    <Td>
                      {bundle.bundleItems.length === 0 ? (
                        <span className="text-xs text-[var(--color-danger)]">
                          بلا أصناف
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          {bundle.bundleItems.slice(0, 3).map((item, index) => (
                            <p
                              key={index}
                              className={cn(
                                'text-xs',
                                item.itemVariant.stock <= 0
                                  ? 'text-[var(--color-danger)]'
                                  : 'text-[var(--text-secondary)]',
                              )}
                            >
                              {item.itemVariant.product.name} —{' '}
                              {item.itemVariant.label}
                              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                            </p>
                          ))}

                          {bundle.bundleItems.length > 3 ? (
                            <p className="text-xs text-[var(--text-muted)]">
                              + {bundle.bundleItems.length - 3} أخرى
                            </p>
                          ) : null}

                          {emptyItems.length > 0 ? (
                            <p className="text-xs font-semibold text-[var(--color-warning)]">
                              نفد {emptyItems.length} من أصنافها
                            </p>
                          ) : null}
                        </div>
                      )}
                    </Td>

                    <Td className="tabular font-medium">
                      {prices.length > 0
                        ? formatCurrency(minPrice, currency)
                        : '—'}
                    </Td>

                    <Td>
                      <span
                        className={cn(
                          'tabular rounded-full px-2.5 py-1 text-xs font-semibold',
                          stock <= 0
                            ? 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]'
                            : stock <= 5
                              ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                              : 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
                        )}
                      >
                        {stock}
                      </span>
                    </Td>

                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          bundle.isActive
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--text-muted)]',
                        )}
                      >
                        {bundle.isActive ? (
                          <Eye size={13} aria-hidden />
                        ) : (
                          <EyeOff size={13} aria-hidden />
                        )}
                        {bundle.isActive ? 'منشورة' : 'مخفية'}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableWrap>
    </div>
  );
}
