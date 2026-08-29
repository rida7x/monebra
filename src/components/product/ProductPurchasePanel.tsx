'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Heart, ShoppingBag, Minus, Plus, MessageCircle } from 'lucide-react';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { toast } from '@/stores/toast';
import { track } from '@/components/analytics/Tracker';
import { formatMoney } from '@/lib/money';
import { MAX_ITEM_QUANTITY, STOCK_LEVEL_LABELS } from '@/lib/constants';
import type { VariantData } from '@/lib/services/product-detail';
import { cn } from '@/lib/utils';

/**
 * لوحة الشراء: اختيار الحجم والكمية ثم الإضافة أو الشراء المباشر.
 *
 * قواعد سلوكية:
 *  • يُختار افتراضيًا أول حجم متوفر — لا نبدأ بحجم نافد
 *  • الكمية محصورة بالمخزون الفعلي للحجم المختار وبالحد الأقصى للصنف
 *  • عند تغيير الحجم تُقلَّص الكمية إن تجاوزت مخزون الحجم الجديد
 *  • «شراء الآن» = إضافة + انتقال مباشر إلى السلة
 *
 * الأسعار المعروضة هنا للعرض فقط. الخادم يعيد حسابها كلها عند إنشاء الطلب.
 */
export function ProductPurchasePanel({
  productId,
  productName,
  productSlug,
  variants,
  currency,
  whatsappHref,
}: {
  productId: string;
  productName: string;
  productSlug: string;
  variants: VariantData[];
  currency: { symbol: string; decimals: number };
  whatsappHref: string | null;
}) {
  const router = useRouter();
  const addToCart = useCart((state) => state.add);
  const wishlistIds = useWishlist((state) => state.ids);
  const toggleWishlist = useWishlist((state) => state.toggle);
  const wishlistHydrated = useWishlist((state) => state.hydrated);

  const firstAvailable = variants.find((variant) => variant.inStock) ?? variants[0];

  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? '');
  const [requestedQuantity, setRequestedQuantity] = useState(1);

  const selected =
    variants.find((variant) => variant.id === selectedId) ?? firstAvailable;

  const maxQuantity = Math.min(selected?.stock ?? 0, MAX_ITEM_QUANTITY);
  const isWishlisted = wishlistHydrated && wishlistIds.includes(productId);
  const soldOut = !selected?.inStock;

  // الكمية المعروضة *مشتقّة* من الكمية المطلوبة ومخزون الحجم الحالي، بدل
  // مزامنتها في useEffect. عند التبديل إلى حجم مخزونه أقل تنخفض الكمية
  // فورًا في نفس دورة الرسم — بلا وميض ولا رسم مضاعف.
  const quantity = Math.min(Math.max(requestedQuantity, 1), Math.max(maxQuantity, 1));

  const money = (minor: number) =>
    formatMoney(minor, {
      currency: currency.symbol,
      decimals: currency.decimals,
    });

  function add(): boolean {
    if (!selected || soldOut) return false;

    const result = addToCart(selected.id, quantity);

    if (result === 'full') {
      toast.error('وصلت السلة إلى الحد الأقصى من الأصناف');
      return false;
    }

    track('add_to_cart', { productId });
    return true;
  }

  function handleAdd() {
    if (!add()) return;

    toast.success(`تمت إضافة ${productName} — ${selected?.label} إلى السلة`, {
      label: 'عرض السلة',
      href: '/cart',
    });
  }

  function handleBuyNow() {
    if (!add()) return;
    router.push('/cart');
  }

  function handleWishlist() {
    const added = toggleWishlist(productId);
    toast.info(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة');
  }

  if (!selected) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        لا توجد أحجام متاحة لهذا المنتج حاليًا.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── السعر ── */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="tabular text-3xl font-semibold text-[var(--accent)]">
          {money(selected.price)}
        </span>

        {selected.comparePrice ? (
          <>
            <span className="tabular text-base text-[var(--text-muted)] line-through">
              {money(selected.comparePrice)}
            </span>
            <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-contrast)]">
              وفّر {selected.discountPercent}%
            </span>
          </>
        ) : null}
      </div>

      {/* ── الأحجام ── */}
      {variants.length > 1 ? (
        <fieldset>
          <legend className="mb-3 text-xs font-semibold tracking-wide text-[var(--text-muted)]">
            اختر الحجم
          </legend>

          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const active = variant.id === selected.id;

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  disabled={!variant.inStock}
                  aria-pressed={active}
                  className={cn(
                    'tap-target flex flex-col items-center rounded-xl border px-4 py-2 transition-all duration-300',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--surface-border)] hover:border-[var(--surface-border-strong)]',
                  )}
                >
                  <span className="text-sm font-semibold">{variant.label}</span>
                  <span
                    className={cn(
                      'tabular text-xs',
                      active
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-muted)]',
                    )}
                  >
                    {variant.inStock ? money(variant.price) : 'غير متوفر'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {/* ── حالة المخزون ── */}
      <div className="flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full',
            selected.stockLevel === 'in_stock' && 'bg-[var(--color-success)]',
            selected.stockLevel === 'low_stock' && 'bg-[var(--color-warning)]',
            selected.stockLevel === 'out_of_stock' && 'bg-[var(--color-danger)]',
          )}
        />
        <span
          className={cn(
            selected.stockLevel === 'in_stock' && 'text-[var(--color-success)]',
            selected.stockLevel === 'low_stock' && 'text-[var(--color-warning)]',
            selected.stockLevel === 'out_of_stock' && 'text-[var(--color-danger)]',
          )}
        >
          {STOCK_LEVEL_LABELS[selected.stockLevel]}
        </span>

        {selected.stockLevel === 'low_stock' ? (
          <span className="tabular text-[var(--text-muted)]">
            — بقي {selected.stock}
          </span>
        ) : null}
      </div>

      {/* ── الكمية ── */}
      {!soldOut ? (
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold tracking-wide text-[var(--text-muted)]">
            الكمية
          </span>

          <div className="flex items-center rounded-full border border-[var(--surface-border)]">
            <QuantityButton
              label="إنقاص الكمية"
              onClick={() => setRequestedQuantity(quantity - 1)}
              disabled={quantity <= 1}
            >
              <Minus size={15} aria-hidden />
            </QuantityButton>

            <span
              className="tabular w-12 text-center text-sm font-semibold"
              aria-live="polite"
            >
              {quantity}
            </span>

            <QuantityButton
              label="زيادة الكمية"
              onClick={() => setRequestedQuantity(quantity + 1)}
              disabled={quantity >= maxQuantity}
            >
              <Plus size={15} aria-hidden />
            </QuantityButton>
          </div>
        </div>
      ) : null}

      {/* ── الأزرار ── */}
      <div className="space-y-2.5">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className="tap-target flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-6 text-sm font-semibold transition-all duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <ShoppingBag size={16} aria-hidden />
            أضف إلى السلة
          </button>

          <button
            type="button"
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            aria-pressed={isWishlisted}
            className="tap-target flex items-center justify-center rounded-full border border-[var(--surface-border-strong)] transition-all duration-300 hover:border-[var(--accent)]"
          >
            <Heart
              size={17}
              aria-hidden
              className={cn(
                'transition-colors',
                isWishlisted
                  ? 'fill-[var(--accent)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]',
              )}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={soldOut}
          className="tap-target w-full rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-300 hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {soldOut ? 'غير متوفر حاليًا' : 'شراء الآن'}
        </button>

        {whatsappHref ? (
          <a
            href={`${whatsappHref}${whatsappHref.includes('?') ? '&' : '?'}text=${encodeURIComponent(
              `مرحبًا، أريد الاستفسار عن عطر ${productName} (${selected.label}).\n${siteUrl()}/product/${productSlug}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366]/40 px-6 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white"
          >
            <MessageCircle size={16} aria-hidden />
            استفسر عبر واتساب
          </a>
        ) : null}
      </div>
    </div>
  );
}

function QuantityButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="tap-target flex items-center justify-center rounded-full text-[var(--text-primary)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function siteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
