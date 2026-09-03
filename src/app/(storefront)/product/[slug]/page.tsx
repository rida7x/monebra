import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getSettings, whatsappLink } from '@/lib/settings';
import {
  getProductBySlug,
  getRelatedProducts,
  getApprovedReviews,
  getRatingBreakdown,
} from '@/lib/services/product-detail';
import { prisma } from '@/lib/db';
import { decodeSlug } from '@/lib/utils';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductPurchasePanel } from '@/components/product/ProductPurchasePanel';
import { ProductGrid } from '@/components/product/ProductCard';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductViewTracker } from '@/components/analytics/ProductViewTracker';
import { Badge, SectionHeading, IntensityBar } from '@/components/ui/primitives';
import {
  GENDER_LABELS,
  SEASON_LABELS,
  OCCASION_LABELS,
  TIME_OF_DAY_LABELS,
  NOTE_TYPE_LABELS,
  INTENSITY_LABELS,
  type Gender,
  type Season,
  type Occasion,
  type TimeOfDay,
} from '@/lib/constants';
import { toMajor } from '@/lib/money';

export const revalidate = 120;

type PageProps = { params: Promise<{ slug: string }> };


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
  const [product, settings] = await Promise.all([
    getProductBySlug(slug),
    getSettings(),
  ]);

  if (!product) notFound();

  const title =
    product.metaTitle ||
    (product.inspirationName
      ? `${product.name} — عطر مستوحى من ${product.inspirationName}`
      : product.name);

  const description =
    product.metaDescription ||
    product.shortDescription ||
    `${product.name} من ${settings.storeName}.`;

  const image = product.ogImage || product.images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/product/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

/** روابط مباشرة لكل منتج — تُستخدم في فيديوهات TikTok */
export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true },
    take: 200,
  });

  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const settings = await getSettings();

  const categoryId = product.category
    ? (
        await prisma.category.findUnique({
          where: { slug: product.category.slug },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const [related, firstReviews, breakdown] = await Promise.all([
    getRelatedProducts(product.id, categoryId, product.gender, 4),
    getApprovedReviews(product.id),
    getRatingBreakdown(product.id),
  ]);

  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const cheapest = product.variants.reduce<number | null>(
    (min, variant) => (min === null ? variant.price : Math.min(min, variant.price)),
    null,
  );
  const anyInStock = product.variants.some((variant) => variant.inStock);

  // ── البيانات المنظمة لمحركات البحث ──
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    image: product.images.map((image) => `${siteUrl}${image.url}`),
    brand: { '@type': 'Brand', name: settings.storeName },
    category: product.category?.name,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: settings.currencyCode,
      lowPrice: cheapest !== null ? toMajor(cheapest) : undefined,
      offerCount: product.variants.length,
      availability: anyInStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(product.ratingCount > 0 && product.ratingAverage
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'كل العطور',
        item: `${siteUrl}/products`,
      },
      ...(product.category
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: product.category.name,
              item: `${siteUrl}/category/${product.category.slug}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: product.category ? 4 : 3,
        name: product.name,
        item: `${siteUrl}/product/${product.slug}`,
      },
    ],
  };

  return (
    <main className="container-page py-8 sm:py-12">
      <ProductViewTracker productId={product.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ── مسار التنقل ── */}
      <nav aria-label="مسار التنقل" className="mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5 text-[var(--text-muted)]">
          <Crumb href="/">الرئيسية</Crumb>
          <Separator />
          <Crumb href="/products">كل العطور</Crumb>
          {product.category ? (
            <>
              <Separator />
              <Crumb href={`/category/${product.category.slug}`}>
                {product.category.name}
              </Crumb>
            </>
          ) : null}
          <Separator />
          <li className="text-[var(--text-secondary)]">{product.name}</li>
        </ol>
      </nav>

      {/* ── المعرض ولوحة الشراء ── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery
          images={product.images}
          productName={product.name}
          badges={
            <>
              {product.isBestSeller ? <Badge>الأكثر مبيعًا</Badge> : null}
              {product.isNew ? <Badge>جديد</Badge> : null}
              {product.isLimited ? <Badge>كمية محدودة</Badge> : null}
            </>
          }
        />

        <div>
          <p className="text-xs tracking-wider text-[var(--text-muted)]">
            {GENDER_LABELS[product.gender as Gender]}
            {product.fragranceFamily ? ` · ${product.fragranceFamily}` : ''}
          </p>

          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            {product.name}
          </h1>

          {product.inspirationName ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              عطر مستوحى من{' '}
              <span className="font-semibold text-[var(--text-primary)]">
                {product.inspirationName}
              </span>
              {product.inspirationBrand ? ` — ${product.inspirationBrand}` : ''}
            </p>
          ) : null}

          {product.shortDescription ? (
            <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="my-7 h-px rule-gold" />

          <ProductPurchasePanel
            productId={product.id}
            productName={product.name}
            productSlug={product.slug}
            variants={product.variants}
            currency={currency}
            whatsappHref={whatsappLink(settings.whatsappNumber)}
          />

          {/* ── الباقة ── */}
          {product.bundleItems.length > 0 ? (
            <div className="surface-card mt-7 p-5">
              <h2 className="mb-3 text-sm font-semibold">تتضمن هذه الباقة</h2>
              <ul className="space-y-2">
                {product.bundleItems.map((item) => (
                  <li
                    key={`${item.slug}-${item.label}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/product/${item.slug}`}
                      className="text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
                    >
                      {item.name} — {item.label}
                    </Link>
                    <span className="tabular text-[var(--text-muted)]">
                      ×{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── تفاصيل العطر ── */}
      <section className="mt-16 sm:mt-24">
        <SectionHeading title="تفاصيل العطر" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* الخصائص */}
          <div className="surface-card space-y-4 p-6">
            <SpecRow label="نوع العطر" value={product.fragranceFamily} />
            <SpecRow
              label="الجنس"
              value={GENDER_LABELS[product.gender as Gender]}
            />
            <SpecRow
              label="أفضل وقت"
              value={
                product.timeOfDay
                  ? TIME_OF_DAY_LABELS[product.timeOfDay as TimeOfDay]
                  : null
              }
            />
            <SpecRow
              label="الموسم"
              value={
                product.seasons
                  .map((season) => SEASON_LABELS[season as Season])
                  .filter(Boolean)
                  .join('، ') || null
              }
            />
            <SpecRow
              label="المناسبة"
              value={
                product.occasions
                  .map((occasion) => OCCASION_LABELS[occasion as Occasion])
                  .filter(Boolean)
                  .join('، ') || null
              }
            />

            <div className="space-y-3 pt-2">
              <IntensityBar
                value={product.longevity}
                label={`الثبات · ${INTENSITY_LABELS[product.longevity] ?? ''}`}
              />
              <IntensityBar
                value={product.sillage}
                label={`الفوحان · ${INTENSITY_LABELS[product.sillage] ?? ''}`}
              />
            </div>
          </div>

          {/* النوتات */}
          <div className="surface-card space-y-5 p-6">
            {(['top', 'middle', 'base'] as const).map((type) =>
              product.notes[type].length > 0 ? (
                <div key={type}>
                  <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-[var(--accent)]">
                    {NOTE_TYPE_LABELS[type]}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.notes[type].map((note) => (
                      <Link
                        key={note}
                        href={`/products?note=${encodeURIComponent(note)}`}
                        className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {note}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {product.notes.top.length === 0 &&
            product.notes.middle.length === 0 &&
            product.notes.base.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                لم تُضَف نوتات هذا العطر بعد.
              </p>
            ) : null}
          </div>
        </div>

        {product.description ? (
          <div className="surface-card mt-6 p-6 sm:p-8">
            <h3 className="mb-3 text-sm font-semibold">وصف العطر</h3>
            <p className="whitespace-pre-line leading-loose text-[var(--text-secondary)]">
              {product.description}
            </p>
          </div>
        ) : null}
      </section>

      {/* ── التقييمات ── */}
      <ProductReviews
        productId={product.id}
        initialReviews={firstReviews.reviews}
        initialHasMore={firstReviews.hasMore}
        breakdown={breakdown}
        average={product.ratingAverage}
        count={product.ratingCount}
      />

      {/* ── منتجات ذات صلة ── */}
      {related.length > 0 ? (
        <section className="mt-16 sm:mt-24">
          <SectionHeading
            title="قد يعجبك أيضًا"
            action={{ href: '/products', label: 'كل العطور' }}
          />
          <ProductGrid
            products={related}
            currency={currency}
            priorityCount={0}
          />
        </section>
      ) : null}

    </main>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--surface-border)] pb-3 last:border-b-0">
      <span className="shrink-0 text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-end text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
      >
        {children}
      </Link>
    </li>
  );
}

function Separator() {
  return (
    <li aria-hidden className="text-[var(--text-muted)]/50">
      <ChevronLeft size={12} />
    </li>
  );
}
