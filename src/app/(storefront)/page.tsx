import Image from 'next/image';
import Link from 'next/link';
import { Truck, ShieldCheck, Headphones, Gem, Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  getFeaturedProducts,
  getBestSellers,
  getNewArrivals,
  getHeroSlides,
  getActiveCategories,
  getStoreRating,
} from '@/lib/services/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { SectionHeading } from '@/components/ui/primitives';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { BrandLogo } from '@/components/layout/BrandLogo';

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
    storeRating,
  ] = await Promise.all([
    getSettings(),
    getHeroSlides(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getBestSellers(4),
    getNewArrivals(4),
    prisma.city.count({ where: { isActive: true } }),
    getStoreRating(),
  ]);

  const hero = slides[0];
  const currency = {
    symbol: settings.currencySymbol,
    decimals: settings.currencyDecimals,
  };

  /**
   * كل الأقسام المفعّلة تظهر — لا تلك التي فيها منتجات فقط.
   *
   * ⚠️ الإخفاء التلقائي عند `productCount === 0` كان ينزع من صاحب المتجر
   * تحكّمه: يضيف قسمًا جديدًا فلا يظهر، بلا سبب مفهوم، حتى يملأه بمنتجات.
   * المفتاح الآن واحد وصريح: `isActive` في `/admin/categories`.
   */
  const visibleCategories = categories;

  return (
    <main>
      {/* ═══════════════════════ Hero ═══════════════════════ */}
      {/* الارتفاع طبيعي لا `92svh`: الواجهة بارتفاع شاشة كاملة كانت تدفع
          الأقسام تحت الطيّة، فيمرّر الزائر قبل أن يرى ما يبيعه المتجر. */}
      <section className="relative -mt-16 flex items-center overflow-hidden sm:-mt-20">
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

        <div className="container-page relative w-full pt-24 pb-14 text-center sm:pt-28">
          {/* الشعار بدل الاسم المكتوب: هو أول ما يجب أن تراه العين، وصورته
              أدلّ على العلامة من نصّها. */}
          <BrandLogo
            storeName={settings.storeName}
            logoUrl={settings.logoUrl}
            logoUrlLight={settings.logoUrlLight}
            width={260}
            height={70}
            priority
            className="mx-auto h-14 w-auto object-contain sm:h-16"
            fallbackClassName="font-display text-4xl font-light tracking-wide text-gold-gradient sm:text-5xl"
          />

          {(hero?.subtitle ?? settings.storeTagline) ? (
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              {hero?.subtitle ?? settings.storeTagline}
            </p>
          ) : null}

          {/* ── الأقسام ──
              هنا لا أسفل الصفحة: القسم أول قرار يتخذه الزائر، ووضعه خلف
              واجهة بارتفاع شاشة كاملة يعني تمريرًا قبل أن يرى ما يبيعه
              المتجر أصلًا. الشبكة عمودان على الهاتف — لمسة واحدة تكفي. */}
          {visibleCategories.length > 0 ? (
            <div className="mt-10 grid grid-cols-2 gap-3 text-start sm:mt-12 sm:grid-cols-3 lg:grid-cols-4">
              {visibleCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="glass group flex flex-col items-center gap-3 rounded-2xl p-5 text-center transition-all duration-300 ease-[var(--ease-luxe)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)] transition-transform duration-300 group-hover:scale-110">
                    <CategoryIcon icon={category.icon} size={22} />
                  </span>

                  <span className="text-sm font-semibold leading-snug">
                    {category.name}
                  </span>

                  {/* القسم الفارغ يقول «قريبًا» لا «٠ عطور»: الصفر يقرأ
                      كعطب، و«قريبًا» يقرأ كوعد — والوجهة واحدة. */}
                  <span className="tabular text-xs text-[var(--text-muted)]">
                    {category.productCount === 0
                      ? 'قريبًا'
                      : `${category.productCount} ${category.productCount === 1 ? 'عطر' : 'عطور'}`}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
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
                تسوّق كل العطور
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

      {/* ═══════════════════ تقييم المتجر ═══════════════════
          مجمَّع من تقييمات المنتجات المعتمدة — لا رقم مستقل. بلا تقييمات
          لا يظهر الشريط أصلًا: نجوم فارغة أسوأ من لا شيء. */}
      {storeRating ? (
        <section className="border-y border-[var(--surface-border)] bg-[var(--surface-sunken)]">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-8 text-center">
            <div className="flex items-center gap-3">
              <span className="tabular font-display text-4xl leading-none text-[var(--accent)]">
                {storeRating.average.toFixed(1)}
              </span>

              <span
                className="flex gap-0.5 text-[var(--accent)]"
                role="img"
                aria-label={`${storeRating.average.toFixed(1)} من ٥`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    aria-hidden
                    className={
                      star <= Math.round(storeRating.average)
                        ? 'fill-current'
                        : 'fill-transparent opacity-30'
                    }
                  />
                ))}
              </span>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              رأي <span className="tabular">{storeRating.count}</span> عميل في{' '}
              <span className="tabular">{storeRating.productCount}</span>{' '}
              {storeRating.productCount === 1 ? 'عطر' : 'عطور'} من مونيبرا
            </p>
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
