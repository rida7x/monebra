import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { getBestSellers } from '@/lib/services/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { SectionHeading } from '@/components/ui/primitives';
import { CartView } from './CartView';

export const metadata: Metadata = {
  title: 'سلة التسوق',
  robots: { index: false, follow: true },
};

/**
 * صفحة السلة.
 *
 * القشرة تُبنى على الخادم (العنوان، «قد يعجبك أيضًا»)، ومحتوى السلة نفسه
 * عميلي لأنه محفوظ في متصفح الزائر. هذا يعطي أسرع رسم أولي ممكن.
 */
export default async function CartPage() {
  const [settings, suggestions] = await Promise.all([
    getSettings(),
    getBestSellers(4),
  ]);

  return (
    <main className="container-page py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">سلة التسوق</h1>
        <div className="mt-4 h-px w-16 rule-gold" />
      </header>

      <CartView />

      {suggestions.length > 0 ? (
        <section className="mt-16 sm:mt-24">
          <SectionHeading
            title="قد يعجبك أيضًا"
            action={{ href: '/products', label: 'كل العطور' }}
          />
          <ProductGrid
            products={suggestions}
            currency={{
              symbol: settings.currencySymbol,
              decimals: settings.currencyDecimals,
            }}
            priorityCount={0}
          />
        </section>
      ) : null}
    </main>
  );
}
