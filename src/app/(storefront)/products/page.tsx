import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PackageSearch } from 'lucide-react';
import { getSettings } from '@/lib/settings';
import {
  parseFilters,
  queryProducts,
  getFilterOptions,
} from '@/lib/services/product-query';
import { ProductGrid } from '@/components/product/ProductCard';
import { BrandPromise } from '@/components/ui/BrandPromise';
import { ProductFilters } from '@/components/product/ProductFilters';
import { Pagination } from '@/components/product/Pagination';
import { EmptyState } from '@/components/ui/primitives';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    title: 'كل العطور',
    description: `تصفّح مجموعة ${settings.storeName} الكاملة من العطور المستوحاة من أشهر الروائح العالمية.`,
    alternates: { canonical: '/products' },
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * صفحة كل العطور.
 *
 * الفلاتر تُقرأ من الـ URL وتُطبَّق على الخادم، فالصفحة تصل إلى المتصفح
 * مبنية بالكامل — يراها العميل على شبكة ضعيفة قبل تحميل أي JavaScript،
 * وتفهرسها محركات البحث.
 */
export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const [settings, result, options] = await Promise.all([
    getSettings(),
    queryProducts(filters),
    getFilterOptions(),
  ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  function buildHref(page: number): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (!value || key === 'page') continue;
      next.set(key, Array.isArray(value) ? value.join(',') : value);
    }

    if (page > 1) next.set('page', String(page));
    const query = next.toString();
    return query ? `/products?${query}` : '/products';
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <BrandPromise text={settings.categoryPromise} className="mb-9" />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">كل العطور</h1>
        <div className="mt-4 h-px w-16 rule-gold" />
      </header>

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-x-10">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <ProductFilters
            options={options}
            totalResults={result.total}
            currencySymbol={settings.currencySymbol}
          />
        </Suspense>

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          {result.items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={44} />}
              title="لا توجد منتجات مطابقة"
              description="جرّب تخفيف الفلاتر أو توسيع نطاق السعر."
              action={{ href: '/products', label: 'عرض كل العطور' }}
            />
          ) : (
            <>
              <ProductGrid products={result.items} currency={currency} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                buildHref={buildHref}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
