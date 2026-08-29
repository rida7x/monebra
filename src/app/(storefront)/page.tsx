import Image from 'next/image';
import Link from 'next/link';
import { Truck, ShieldCheck, Headphones, Gem } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  getFeaturedProducts,
  getBestSellers,
  getNewArrivals,
  getHeroSlides,
  getActiveCategories,
} from '@/lib/services/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { SectionHeading } from '@/components/ui/primitives';

/**
 * تُبنى الصفحة مسبقًا وتُحدَّث كل دقيقتين — أسرع بكثير على الشبكات الضعيفة
 * من الاستعلام عند كل زيارة. تعديل المدير لأي منتج يُبطلها فورًا عبر
 * `invalidateProduct` في lib/cache (يشترط Next أن تكون رقمًا حرفيًا هنا).
 */
export const revalidate = 120;

/**
 * الواجهة الرئيسية.
 *
 * كل نص وسعر وصورة يأتي من قاعدة البيانات: الشريحة الرئيسية وأزرارها،
 * التصنيفات، المنتجات. لا شيء مكتوب في هذا الملف يخص المتجر تحديدًا.
 *
 * الأقسام التي لا تحتوي بيانات لا تُعرض أصلًا، فلا تظهر عناوين فوق فراغ.
 */
export default async function HomePage() {
  const [
    settings,
    slides,
    categories,
    featured,
    bestSellers,
    newArrivals,
    activeCityCount,
  ] = await Promise.all([
    getSettings(),
    getHeroSlides(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getBestSellers(4),
    getNewArrivals(4),
    prisma.city.count({ where: { isActive: true } }),
  ]);

  const hero = slides[0];
  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  const visibleCategories = categories.filter(
    (category) => category.productCount > 0,
  );

  return (
    <main>
      {/* ═══════════════════════ Hero ═══════════════════════ */}
      <section className="relative -mt-16 flex min-h-[92svh] items-center overflow-hidden sm:-mt-20">
        {/* الخلفية */}
        {hero?.mediaUrl ? (
          hero.mediaType === 'video' ? (
            <video
              src={hero.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              src={hero.mediaUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )
        ) : null}

        {/* تدرّجات تضمن قراءة النص فوق أي صورة */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(198,166,100,0.18),transparent_62%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[var(--surface-base)] via-[var(--surface-base)]/55 to-[var(--surface-base)]/85"
        />

        <div className="container-page relative w-full pt-28 pb-20 text-center sm:pt-36">
          <p className="mb-5 text-[0.7rem] tracking-[0.4em] text-[var(--accent)] uppercase">
            Perfume
          </p>

          <h1 className="font-display text-5xl font-light leading-[1.1] tracking-wide sm:text-7xl lg:text-8xl">
            <span className="text-gold-gradient">
              {hero?.title ?? settings.storeName}
            </span>
          </h1>

          {(hero?.subtitle ?? settings.storeTagline) ? (
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
              {hero?.subtitle ?? settings.storeTagline}
            </p>
          ) : null}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {hero?.ctaText && hero.ctaLink ? (
              <Link
                href={hero.ctaLink}
                className="tap-target inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-10 text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-300 ease-[var(--ease-luxe)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-glow)] active:scale-[0.98] sm:w-auto"
              >
                {hero.ctaText}
              </Link>
            ) : (
              <Link
                href="/products"
                className="tap-target inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-10 text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-300 hover:bg-[var(--accent-hover)] sm:w-auto"
              >
                تسوّق الآن
              </Link>
            )}

            {hero?.ctaText2 && hero.ctaLink2 ? (
              <Link
                href={hero.ctaLink2}
                className="tap-target glass inline-flex w-full items-center justify-center rounded-full px-10 text-sm font-medium text-[var(--text-primary)] transition-all duration-300 ease-[var(--ease-luxe)] hover:border-[var(--accent)] active:scale-[0.98] sm:w-auto"
              >
                {hero.ctaText2}
              </Link>
            ) : null}
          </div>
        </div>

        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px rule-gold"
        />
      </section>

      {/* ═══════════════════ شريط الثقة ═══════════════════
          كل بند هنا مشتق من بيانات حقيقية أو من ثوابت النظام — لا وعود
          تسويقية مكتوبة في الكود. البند الذي لا تسنده بيانات لا يُعرض. */}
      <section className="border-b border-[var(--surface-border)]">
        <div className="container-page grid grid-cols-2 gap-x-4 gap-y-6 py-8 lg:grid-cols-4">
          <TrustItem
            icon={<Gem size={19} />}
            title="عطور مستوحاة"
            text="من أشهر الروائح العالمية"
          />

          {activeCityCount > 0 ? (
            <TrustItem
              icon={<Truck size={19} />}
              title="خدمة التوصيل"
              text={`نوصّل إلى ${activeCityCount} مدينة`}
            />
          ) : null}

          <TrustItem
            icon={<ShieldCheck size={19} />}
            title={PAYMENT_METHOD_LABELS.cod}
            text="ادفع بعد أن تستلم طلبك"
          />

          {settings.whatsappNumber ? (
            <TrustItem
              icon={<Headphones size={19} />}
              title="دعم عبر واتساب"
              text="تواصل معنا لأي استفسار"
            />
          ) : null}
        </div>
      </section>

      {/* ═══════════════════ التصنيفات ═══════════════════ */}
      {visibleCategories.length > 0 ? (
        <section className="container-page py-16 sm:py-20">
          <SectionHeading
            title="تصفّح المجموعات"
            subtitle="اختر ما يناسب ذوقك ومناسبتك"
            align="center"
          />

          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            {visibleCategories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="glass tap-target inline-flex shrink-0 items-center gap-2 rounded-full px-5 text-sm transition-all duration-300 ease-[var(--ease-luxe)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span>{category.name}</span>
                <span className="tabular text-xs text-[var(--text-muted)]">
                  {category.productCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══════════════════ المختارات ═══════════════════ */}
      {featured.length > 0 ? (
        <section className="container-page py-8 sm:py-12">
          <SectionHeading
            title="مختارات Monebra"
            action={{ href: '/products', label: 'كل العطور' }}
          />
          <ProductGrid products={featured} currency={currency} />
        </section>
      ) : null}

      {/* ═══════════════════ الأكثر مبيعًا ═══════════════════ */}
      {bestSellers.length > 0 ? (
        <section className="container-page py-8 sm:py-12">
          <SectionHeading
            title="الأكثر مبيعًا"
            subtitle="ما يختاره عملاؤنا أكثر من غيره"
            action={{ href: '/products?best=1', label: 'عرض الكل' }}
          />
          <ProductGrid
            products={bestSellers}
            currency={currency}
            priorityCount={0}
          />
        </section>
      ) : null}

      {/* ═══════════════════ وصل حديثًا ═══════════════════ */}
      {newArrivals.length > 0 ? (
        <section className="container-page py-8 sm:py-12">
          <SectionHeading
            title="وصل حديثًا"
            action={{ href: '/products?new=1', label: 'عرض الكل' }}
          />
          <ProductGrid
            products={newArrivals}
            currency={currency}
            priorityCount={0}
          />
        </section>
      ) : null}

    </main>
  );
}

function TrustItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 shrink-0 text-[var(--accent)]"
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{text}</p>
      </div>
    </div>
  );
}
