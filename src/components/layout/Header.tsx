'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, Heart, ShoppingBag, X } from 'lucide-react';
import { useCart, cartCount } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';

export type NavLink = { label: string; href: string };

/**
 * رأس الموقع.
 *
 * • شفاف فوق الـ Hero ثم يتحول إلى زجاجي عند التمرير — يبقى الأثر
 *   السينمائي دون أن يضيع الرأس على خلفيات فاتحة
 * • العدّادات تُخفى حتى تسترجع المتاجر حالتها من localStorage، فلا يومض
 *   الرقم من 0 إلى قيمته الحقيقية بعد الترطيب (hydration)
 * • قائمة الهاتف تُغلق تلقائيًا عند تغيّر المسار
 */
export function Header({
  storeName,
  logoUrl,
  logoUrlLight,
  links,
  announcement,
}: {
  storeName: string;
  logoUrl: string;
  logoUrlLight: string;
  links: NavLink[];
  announcement: string;
}) {
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // نقرأ موضع التمرير من المتصفح مباشرة بدل مزامنته داخل useEffect.
  // هذا يعطي القيمة الصحيحة فورًا عند تحديث صفحة وسط المحتوى، ويتجنّب
  // دورة رسم إضافية عند أول تحميل.
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 24,
    () => false,
  );

  const cartLines = useCart((state) => state.lines);
  const cartHydrated = useCart((state) => state.hydrated);
  const wishlistIds = useWishlist((state) => state.ids);
  const wishlistHydrated = useWishlist((state) => state.hydrated);

  const cartTotal = cartCount(cartLines);

  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <>
      {announcement ? (
        <div className="bg-[var(--accent)] px-4 py-2 text-center text-xs font-medium text-[var(--accent-contrast)]">
          {announcement}
        </div>
      ) : null}

      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-500 ease-[var(--ease-luxe)]',
          scrolled
            ? 'glass border-b shadow-[var(--shadow-soft)]'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-20">
          {/* ── القائمة على الهاتف ── */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={menuOpen}
            className="tap-target -ms-2 flex items-center justify-center rounded-full text-[var(--text-primary)] lg:hidden"
          >
            <Menu size={22} aria-hidden />
          </button>

          {/* ── الشعار ── */}
          <Link
            href="/"
            aria-label={storeName}
            className="tap-target flex shrink-0 items-center gap-2 lg:me-6"
          >
            <BrandLogo
              storeName={storeName}
              logoUrl={logoUrl}
              logoUrlLight={logoUrlLight}
              width={140}
              height={36}
              priority
              className="h-8 w-auto object-contain sm:h-9"
              fallbackClassName="font-display text-xl tracking-wide text-gold-gradient sm:text-2xl"
            />
          </Link>

          {/* ── التنقل على الشاشات الكبيرة ── */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden flex-1 items-center gap-1 lg:flex"
          >
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm transition-colors duration-300',
                    active
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* ── الإجراءات ── */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="بحث"
              className="tap-target flex items-center justify-center rounded-full text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
            >
              <Search size={20} aria-hidden />
            </button>

            {/* على الهاتف يقع في درج القائمة: شريط الرأس ضيق، والسلة
                والبحث أولى بمساحته */}
            <ThemeToggle className="hidden sm:flex" />

            <IconLink
              href="/wishlist"
              label="المفضلة"
              count={wishlistHydrated ? wishlistIds.length : null}
              className="hidden sm:flex"
            >
              <Heart size={20} aria-hidden />
            </IconLink>

            <IconLink
              href="/cart"
              label="السلة"
              count={cartHydrated ? cartTotal : null}
            >
              <ShoppingBag size={20} aria-hidden />
            </IconLink>
          </div>
        </div>
      </header>

      {/* ── درج القائمة على الهاتف ── */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="القائمة"
          >
            <button
              type="button"
              aria-label="إغلاق القائمة"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
            />

            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 end-0 flex w-[82%] max-w-sm flex-col bg-[var(--surface-raised)] shadow-[var(--shadow-deep)]"
            >
              <div className="flex h-16 items-center justify-between border-b border-[var(--surface-border)] px-5">
                <span className="font-display text-lg text-gold-gradient">
                  {storeName}
                </span>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="إغلاق"
                  className="tap-target flex items-center justify-center rounded-full text-[var(--text-secondary)]"
                >
                  <X size={20} aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
                  >
                    {link.label}
                  </Link>
                ))}

                <Link
                  href="/wishlist"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-5 py-4 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  المفضلة
                  {wishlistHydrated && wishlistIds.length > 0 ? (
                    <span className="tabular rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--accent-contrast)]">
                      {wishlistIds.length}
                    </span>
                  ) : null}
                </Link>
              </div>

              {/* مقابل زر التبديل المخفي على الهاتف في شريط الرأس.
                  لا يُغلق الدرج عند الضغط: يرى الزائر أثر التبديل فورًا. */}
              <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-5 py-3">
                <span className="text-sm text-[var(--text-secondary)]">
                  مظهر الموقع
                </span>
                <ThemeToggle />
              </div>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function IconLink({
  href,
  label,
  count,
  children,
  className,
}: {
  href: string;
  label: string;
  /** null = لم تُسترجع الحالة بعد، فلا نعرض رقمًا */
  count: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count})` : label}
      className={cn(
        'tap-target relative flex items-center justify-center rounded-full text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]',
        className,
      )}
    >
      {children}

      {count !== null && count > 0 ? (
        <span className="tabular absolute -top-0.5 end-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.6rem] font-bold leading-none text-[var(--accent-contrast)]">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

/** اشتراك مشترك لكل مستدعي useSyncExternalStore — مستمع واحد فقط */
function subscribeToScroll(onChange: () => void): () => void {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}
