import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Eye,
  ShoppingCart,
  CreditCard,
  Percent,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  StatCard,
  TableWrap,
  Table,
  Th,
  Td,
  PanelHeading,
  PanelEmpty,
} from '@/components/admin/ui';

export const metadata: Metadata = {
  title: 'التحليلات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** نافذة القياس بالأيام */
const WINDOW_DAYS = 30;

/**
 * التحليلات — داخلية بالكامل.
 *
 * لا خدمة خارجية ولا ملفات تتبّع: كل ما يظهر هنا مُجمَّع من جدول
 * `analytics_events` الذي يملأه المتجر نفسه. لا نخزّن عنوان IP ولا معرّفًا
 * دائمًا للزائر، فالأرقام إجمالية بطبيعتها.
 *
 * معدّل التحويل = الطلبات ÷ الجلسات التي شاهدت صفحة. مقياس تقريبي لكنه
 * صادق: لا يدّعي دقة لا يملكها.
 */
export default async function AdminAnalyticsPage() {
  await requirePageAccess('analytics.view');

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [
    pageViews,
    productViews,
    addToCarts,
    checkouts,
    sessions,
    orders,
    devices,
    topViewed,
    topAdded,
  ] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { type: 'page_view', createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: 'product_view', createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: 'add_to_cart', createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: 'begin_checkout', createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since }, sessionId: { not: null } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.groupBy({
      by: ['deviceType'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: {
        type: 'product_view',
        productId: { not: null },
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: {
        type: 'add_to_cart',
        productId: { not: null },
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 10,
    }),
  ]);

  // نجلب أسماء المنتجات دفعة واحدة بدل استعلام لكل صف
  const productIds = [
    ...new Set(
      [...topViewed, ...topAdded]
        .map((row) => row.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, salesCount: true },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  const sessionCount = sessions.length;
  const conversionRate =
    sessionCount > 0 ? (orders / sessionCount) * 100 : 0;
  const cartRate =
    productViews > 0 ? (addToCarts / productViews) * 100 : 0;
  const checkoutRate = addToCarts > 0 ? (checkouts / addToCarts) * 100 : 0;

  const deviceTotal = devices.reduce((sum, row) => sum + row._count, 0);

  const deviceLabels: Record<string, { label: string; icon: typeof Monitor }> = {
    mobile: { label: 'هاتف', icon: Smartphone },
    tablet: { label: 'جهاز لوحي', icon: Tablet },
    desktop: { label: 'كمبيوتر', icon: Monitor },
    unknown: { label: 'غير معروف', icon: Monitor },
  };

  const hasData = pageViews + productViews + addToCarts > 0;

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/8 p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        أرقام آخر {WINDOW_DAYS} يومًا، مجمّعة داخل متجرك بلا أي خدمة تتبّع
        خارجية. لا نحفظ عناوين IP ولا معرّفات دائمة للزوار.
      </p>

      {!hasData ? (
        <p className="surface-card px-4 py-12 text-center text-sm text-[var(--text-muted)]">
          لا توجد بيانات كافية بعد. ستمتلئ هذه الصفحة مع زيارات المتجر.
        </p>
      ) : null}

      {/* ═══════════ مسار التحويل ═══════════ */}
      <section
        aria-label="مسار التحويل"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="جلسات الزوار"
          value={String(sessionCount)}
          hint={`${pageViews} مشاهدة صفحة`}
          icon={<Eye size={18} />}
        />
        <StatCard
          label="مشاهدات المنتجات"
          value={String(productViews)}
          icon={<Eye size={18} />}
        />
        <StatCard
          label="إضافات للسلة"
          value={String(addToCarts)}
          hint={`${cartRate.toFixed(1)}٪ من المشاهدات`}
          icon={<ShoppingCart size={18} />}
          tone="accent"
        />
        <StatCard
          label="بدء الدفع"
          value={String(checkouts)}
          hint={`${checkoutRate.toFixed(1)}٪ من السلات`}
          icon={<CreditCard size={18} />}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="الطلبات المكتملة"
          value={String(orders)}
          icon={<ShoppingCart size={18} />}
          tone="success"
          href="/admin/orders"
        />
        <StatCard
          label="معدّل التحويل"
          value={`${conversionRate.toFixed(1)}٪`}
          hint="طلبات ÷ جلسات"
          icon={<Percent size={18} />}
          tone="accent"
        />
      </section>

      {/* ═══════════ الأجهزة ═══════════ */}
      {deviceTotal > 0 ? (
        <section className="surface-card p-4 sm:p-5">
          <PanelHeading title="الزوار حسب الجهاز" />

          <div className="space-y-3">
            {devices
              .sort((a, b) => b._count - a._count)
              .map((row) => {
                const key = row.deviceType ?? 'unknown';
                const info = deviceLabels[key] ?? deviceLabels.unknown!;
                const Icon = info.icon;
                const percent = (row._count / deviceTotal) * 100;

                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Icon
                          size={15}
                          className="text-[var(--text-muted)]"
                          aria-hidden
                        />
                        {info.label}
                      </span>
                      <span className="tabular text-[var(--text-secondary)]">
                        {percent.toFixed(0)}٪ · {row._count}
                      </span>
                    </div>

                    <div
                      className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                      role="img"
                      aria-label={`${info.label}: ${percent.toFixed(0)} بالمئة`}
                    >
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      {/* ═══════════ الأكثر مشاهدة وإضافة ═══════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <PanelHeading title="الأكثر مشاهدة" />

          <TableWrap>
            {topViewed.length === 0 ? (
              <PanelEmpty message="لا توجد مشاهدات بعد" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>المنتج</Th>
                    <Th>المشاهدات</Th>
                    <Th>المبيعات</Th>
                  </tr>
                </thead>
                <tbody>
                  {topViewed.map((row) => {
                    const product = row.productId ? byId.get(row.productId) : null;
                    if (!product) return null;

                    return (
                      <tr key={row.productId}>
                        <Td>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                          >
                            {product.name}
                          </Link>
                        </Td>
                        <Td className="tabular">{row._count}</Td>
                        <Td className="tabular text-[var(--text-secondary)]">
                          {product.salesCount}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </TableWrap>
        </section>

        <section>
          <PanelHeading title="الأكثر إضافة للسلة" />

          <TableWrap>
            {topAdded.length === 0 ? (
              <PanelEmpty message="لا توجد إضافات بعد" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>المنتج</Th>
                    <Th>الإضافات</Th>
                    <Th>المبيعات</Th>
                  </tr>
                </thead>
                <tbody>
                  {topAdded.map((row) => {
                    const product = row.productId ? byId.get(row.productId) : null;
                    if (!product) return null;

                    return (
                      <tr key={row.productId}>
                        <Td>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                          >
                            {product.name}
                          </Link>
                        </Td>
                        <Td className="tabular">{row._count}</Td>
                        <Td className="tabular text-[var(--text-secondary)]">
                          {product.salesCount}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </TableWrap>
        </section>
      </div>
    </div>
  );
}
