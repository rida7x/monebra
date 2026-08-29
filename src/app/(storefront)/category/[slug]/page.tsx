import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, cache } from 'react';
import { PackageSearch } from 'lucide-react';
import { prisma } from '@/lib/db';
import { decodeSlug } from '@/lib/utils';
import { getSettings } from '@/lib/settings';
import {
  parseFilters,
  queryProducts,
  getFilterOptions,
} from '@/lib/services/product-query';
import { ProductGrid } from '@/components/product/ProductCard';
import { ProductFilters } from '@/components/product/ProductFilters';
import { Pagination } from '@/components/product/Pagination';
import { EmptyState } from '@/components/ui/primitives';

export const revalidate = 120;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** ملفوفة بـ cache: استعلام واحد يخدم generateMetadata والصفحة معًا */
const loadCategory = cache(async (slug: string) => {
  return prisma.category.findFirst({
    where: { slug, isActive: true },
    select: {
      name: true,
      slug: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
});


/**
 * ⚠️ `notFound()` يجب أن تُستدعى هنا أيضًا، لا في مكوّن الصفحة وحده.
 *
 * عندما تنجح generateMetadata وتُرجع عنوانًا لمنتج غير موجود، يُثبّت Next
 * ترويسة الاستجابة ويبدأ البث بحالة 200، فيستحيل بعدها تغييرها إلى 404 حين
 * تستدعيها الصفحة. النتيجة: روابط منتجات وهمية تبدو صالحة لمحركات البحث.
 * الاستعلام ملفوف بـ cache() فلا يتكرر بين هذه الدالة والصفحة.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const category = await loadCategory(slug);

  if (!category) notFound();

  return {
    title: category.metaTitle || category.name,
    description:
      category.metaDescription ||
      category.description ||
      `تصفّح ${category.name} من Monebra Perfume.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  return categories.map((category) => ({ slug: category.slug }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug: rawSlug }, query] = await Promise.all([params, searchParams]);
  const slug = decodeSlug(rawSlug);

  const category = await loadCategory(slug);

  if (!category) notFound();

  // التصنيف مثبّت من المسار — لا يستطيع المستخدم تجاوزه بمعامل في الرابط
  const filters = { ...parseFilters(query), categorySlug: slug };

  const [settings, result, options] = await Promise.all([
    getSettings(),
    queryProducts(filters),
    getFilterOptions(),
  ]);

  function buildHref(page: number): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (!value || key === 'page' || key === 'category') continue;
      next.set(key, Array.isArray(value) ? value.join(',') : value);
    }

    if (page > 1) next.set('page', String(page));
    const search = next.toString();
    return search ? `/category/${slug}?${search}` : `/category/${slug}`;
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">{category.name}</h1>

        {category.description ? (
          <p className="mt-3 max-w-2xl leading-relaxed text-[var(--text-secondary)]">
            {category.description}
          </p>
        ) : null}

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
              title="لا توجد منتجات في هذا التصنيف"
              description="جرّب تخفيف الفلاتر أو تصفّح باقي المجموعات."
              action={{ href: '/products', label: 'عرض كل العطور' }}
            />
          ) : (
            <>
              <ProductGrid
                products={result.items}
                currency={{
                  symbol: settings.currencySymbol,
                  decimals: settings.currencyDecimals,
                }}
              />
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
