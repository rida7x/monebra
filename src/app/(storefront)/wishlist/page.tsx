import type { Metadata } from 'next';
import { WishlistView } from './WishlistView';

export const metadata: Metadata = {
  title: 'المفضلة',
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
  return (
    <main className="container-page py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">المفضلة</h1>
        <div className="mt-4 h-px w-16 rule-gold" />
      </header>

      <WishlistView />
    </main>
  );
}
