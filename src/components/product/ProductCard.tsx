'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Heart, ShoppingBag, Ruler } from 'lucide-react';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { toast } from '@/stores/toast';
import { track } from '@/components/analytics/Tracker';
import { formatMoney } from '@/lib/money';
import { GENDER_LABELS, STOCK_LEVEL_LABELS, type Gender } from '@/lib/constants';
import type { ProductCardData } from '@/lib/services/catalog';
import { cn } from '@/lib/utils';

export type CurrencyDisplay = { symbol: string; decimals: number };

/**
 * بطاقة المنتج.
 *
 * سلوك زر السلة مقصود:
 *  • حجم واحد   → إضافة مباشرة إلى السلة من البطاقة
 *  • عدة أحجام  → الانتقال لصفحة المنتج لاختيار الحجم
 *  • نفد المخزون → الزر معطّل
 *
 * لا نضيف حجمًا نيابة عن العميل عند تعدد الأحجام، فذلك يسبب طلبات خاطئة
 * ومرتجعات.
 */
export function ProductCard({
  product,
  currency,
  priority = false,
}: {
  product: ProductCardData;
  currency: CurrencyDisplay;
  /** للصور الأولى في الشاشة الأولى فقط */
  priority?: boolean;
}) {
  const router = useRouter();
  const addToCart = useCart((state) => state.add);
  const wishlistIds = useWishlist((state) => state.ids);
  const toggleWishlist = useWishlist((state) => state.toggle);
  const wishlistHydrated = useWishlist((state) => state.hydrated);

  const [adding, setAdding] = useState(false);

  const isWishlisted = wishlistHydrated && wishlistIds.includes(product.id);
  const outOfStock = product.stockLevel === 'out_of_stock';
  const needsSizeChoice = product.variantCount > 1;

  const money = (minor: number) =>
    formatMoney(minor, {
      currency: currency.symbol,
      decimals: currency.decimals,
    });

  const productHref = `/product/${product.slug}`;

  function handleCartClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (outOfStock) return;

    if (needsSizeChoice || !product.defaultVariantId) {
      router.push(productHref);
      return;
    }

    setAdding(true);
    const result = addToCart(product.defaultVariantId, 1);
    setAdding(false);

    if (result === 'full') {
      toast.error('وصلت السلة إلى الحد الأقصى من الأصناف');
      return;
    }

    track('add_to_cart', { productId: product.id });

    toast.success(`تمت إضافة ${product.name} إلى السلة`, {
      label: 'عرض السلة',
      href: '/cart',
    });
  }

  function handleWishlistClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const added = toggleWishlist(product.id);
    toast.info(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة');
  }

  return (
    <article className="surface-card group relative flex flex-col overflow-hidden transition-all duration-500 ease-[var(--ease-luxe)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-lift)]">
      <Link href={productHref} className="flex flex-1 flex-col">
        {/* ── الصورة ── */}
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-sunken)]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.06]"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,var(--surface-sunken),var(--surface-raised))]"
              aria-hidden
            >
              <span className="font-display text-5xl text-[var(--text-muted)]/25">
                M
              </span>
            </div>
          )}

          {/* ── الشارات ── */}
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-2.5 sm:p-3">
            {product.discountPercent > 0 ? (
              <CardBadge tone="accent">خصم {product.discountPercent}%</CardBadge>
            ) : null}
            {product.isBestSeller ? <CardBadge>الأكثر مبيعًا</CardBadge> : null}
            {product.isNew ? <CardBadge>جديد</CardBadge> : null}
            {product.isLimited ? <CardBadge>كمية محدودة</CardBadge> : null}
          </div>

          {/* ── المفضلة ── */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={
              isWishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'
            }
            aria-pressed={isWishlisted}
            className="glass tap-target absolute bottom-2 start-2 flex items-center justify-center rounded-full transition-all duration-300 hover:border-[var(--accent)] sm:bottom-2.5 sm:start-2.5"
          >
            <Heart
              size={16}
              aria-hidden
              className={cn(
                'transition-colors',
                isWishlisted
                  ? 'fill-[var(--accent)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]',
              )}
            />
          </button>

          {/* ── نفاد المخزون ── */}
          {outOfStock ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-base)]/70 backdrop-blur-[2px]">
              <span className="rounded-full border border-[var(--surface-border-strong)] bg-[var(--surface-base)]/80 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                {STOCK_LEVEL_LABELS.out_of_stock}
              </span>
            </div>
          ) : null}
        </div>

        {/* ── المعلومات ── */}
        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <p className="text-[0.7rem] tracking-wider text-[var(--text-muted)]">
            {GENDER_LABELS[product.gender as Gender] ?? product.categoryName ?? ''}
          </p>

          <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold sm:text-base">
            {product.name}
          </h3>

          {product.inspirationName ? (
            <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">
              مستوحى من {product.inspirationName}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-3">
            {product.variantCount > 1 ? (
              <span className="text-[0.7rem] text-[var(--text-muted)]">من</span>
            ) : null}

            <span className="tabular text-base font-semibold text-[var(--accent)]">
              {money(product.price)}
            </span>

            {product.comparePrice ? (
              <span className="tabular text-xs text-[var(--text-muted)] line-through">
                {money(product.comparePrice)}
              </span>
            ) : null}
          </div>

          {product.stockLevel === 'low_stock' ? (
            <p className="mt-1.5 text-[0.7rem] text-[var(--color-warning)]">
              {STOCK_LEVEL_LABELS.low_stock}
            </p>
          ) : null}
        </div>
      </Link>

      {/* ── زر السلة ── */}
      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        <button
          type="button"
          onClick={handleCartClick}
          disabled={outOfStock || adding}
          className={cn(
            'tap-target flex w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold',
            'transition-all duration-300 ease-[var(--ease-luxe)] active:scale-[0.98]',
            'disabled:pointer-events-none disabled:opacity-40',
            outOfStock
              ? 'border border-[var(--surface-border)] text-[var(--text-muted)]'
              : 'border border-[var(--surface-border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]',
          )}
        >
          {outOfStock ? (
            STOCK_LEVEL_LABELS.out_of_stock
          ) : needsSizeChoice ? (
            <>
              <Ruler size={14} aria-hidden />
              اختر الحجم
            </>
          ) : (
            <>
              <ShoppingBag size={14} aria-hidden />
              أضف إلى السلة
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function CardBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[0.65rem] font-semibold leading-none',
        tone === 'accent'
          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
          : 'glass text-[var(--text-primary)]',
      )}
    >
      {children}
    </span>
  );
}

/** شبكة منتجات موحّدة — تُستخدم في كل الصفحات */
export function ProductGrid({
  products,
  currency,
  priorityCount = 4,
}: {
  products: ProductCardData[];
  currency: CurrencyDisplay;
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          currency={currency}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
