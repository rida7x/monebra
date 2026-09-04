import type { Metadata } from 'next';
import { SearchX } from 'lucide-react';
import { getSettings } from '@/lib/settings';
import {
  parseFilters,
  queryProducts,
  getFilterOptions,
  getSuggestions,
} from '@/lib/services/product-query';
import { sanitizeQuery } from '@/lib/search';
import { ProductGrid } from '@/components/product/ProductCard';
import { ProductFilters } from '@/components/product/ProductFilters';
import { Pagination } from '@/components/product/Pagination';
import { SectionHeading } from '@/components/ui/primitives';
import { BrandPromise } from '@/components/ui/BrandPromise';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'نتائج البحث',
  robots: { index: false, follow: true },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * صفحة نتائج البحث.
 *
 * عند عدم وجود نتائج لا نترك العميل في طريق مسدود: نعرض رسالة واضحة،
 * نصائح لتوسيع البحث، ومقترحات من الأكثر مبيعًا.
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawQuery = params.q;
  const query = sanitizeQuery(
    Array.isArray(rawQuery) ? rawQuery[0] : rawQuery,
  );

  const filters = parseFilters(params);

  const [settings, result, options] = await Promise.all([
    getSettings(),
    query.length >= 2
      ? queryProducts(filters)
      : Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 24,
          totalPages: 1,
        }),
    getFilterOptions(),
  ]);

  const suggestions =
    result.items.length === 0 ? await getSuggestions(4) : [];

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
    return `/search?${next.toString()}`;
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <BrandPromise text={settings.categoryPromise} className="mb-9" />

      <header className="mb-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {query ? (
            <>
              نتائج البحث عن{' '}
              <span className="text-[var(--accent)]">«{query}»</span>
            </>
          ) : (
            'البحث'
          )}
        </h1>
        <div className="mt-4 h-px w-16 rule-gold" />
      </header>

      {result.items.length > 0 ? (
        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-x-10">
          <Suspense fallback={<div className="hidden lg:block" />}>
            <ProductFilters
              options={options}
              totalResults={result.total}
              currencySymbol={settings.currencySymbol}
            />
          </Suspense>

          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <ProductGrid products={result.items} currency={currency} />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              buildHref={buildHref}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="surface-card flex flex-col items-center gap-3 px-6 py-16 text-center sm:py-20">
            <SearchX
              size={44}
              className="text-[var(--text-muted)]/40"
              aria-hidden
            />

            <h2 className="text-lg font-semibold">لم نجد ما تبحث عنه</h2>

            <p className="max-w-md text-sm text-[var(--text-secondary)]">
              {query.length < 2
                ? 'اكتب كلمة من حرفين على الأقل للبحث.'
                : 'جرّب كلمة أقصر، أو ابحث باسم العطر العالمي الذي يستوحي منه، أو بإحدى نوتاته مثل «عود» أو «فانيليا».'}
            </p>
          </div>

          {suggestions.length > 0 ? (
            <section className="mt-14">
              <SectionHeading
                title="قد تعجبك هذه العطور"
                subtitle="الأكثر طلبًا لدى عملائنا"
                action={{ href: '/products', label: 'كل العطور' }}
              />
              <ProductGrid
                products={suggestions}
                currency={currency}
                priorityCount={0}
              />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
