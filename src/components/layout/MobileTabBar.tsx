'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Heart, ShoppingBag } from 'lucide-react';
import { useCart, cartCount } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { cn } from '@/lib/utils';

/**
 * شريط التنقل السفلي — للهاتف فقط.
 *
 * يقرّب التجربة من التطبيق الأصلي: الوصول إلى السلة والمفضلة بإبهام واحد
 * في كل صفحة. `pb-[env(safe-area-inset-bottom)]` يمنع اختفاء الشريط خلف
 * شريط الإيماءات في أجهزة iPhone الحديثة.
 *
 * الصفحات تضيف حشوة سفلية عبر `pb-20 lg:pb-0` حتى لا يغطي الشريط المحتوى.
 */

const TABS = [
  { href: '/', label: 'الرئيسية', icon: Home, exact: true },
  { href: '/products', label: 'المتجر', icon: LayoutGrid, exact: false },
  { href: '/wishlist', label: 'المفضلة', icon: Heart, exact: false },
  { href: '/cart', label: 'السلة', icon: ShoppingBag, exact: false },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  const cartLines = useCart((state) => state.lines);
  const cartHydrated = useCart((state) => state.hydrated);
  const wishlistIds = useWishlist((state) => state.ids);
  const wishlistHydrated = useWishlist((state) => state.hydrated);

  function badgeFor(href: string): number | null {
    if (href === '/cart') return cartHydrated ? cartCount(cartLines) : null;
    if (href === '/wishlist') return wishlistHydrated ? wishlistIds.length : null;
    return null;
  }

  return (
    <nav
      aria-label="التنقل السريع"
      className="glass fixed inset-x-0 bottom-0 z-[60] border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          const badge = badgeFor(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[0.65rem] transition-colors',
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)]',
              )}
            >
              <span className="relative">
                <Icon
                  size={21}
                  aria-hidden
                  className={active ? 'fill-[var(--accent)]/15' : undefined}
                />

                {badge !== null && badge > 0 ? (
                  <span className="tabular absolute -top-1.5 -end-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.58rem] font-bold leading-none text-[var(--accent-contrast)]">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>

              <span className="font-medium">{tab.label}</span>

              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[var(--accent)]"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
