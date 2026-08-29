'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  TriangleAlert,
  Loader2,
} from 'lucide-react';
import { useCart } from '@/stores/cart';
import { toast } from '@/stores/toast';
import { formatMoney } from '@/lib/money';
import { STOCK_LEVEL_LABELS } from '@/lib/constants';
import type { ValidatedCart, CartIssue } from '@/lib/services/cart';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

type CartResponse = ValidatedCart & {
  currency: { symbol: string; decimals: number };
  freeDeliveryThreshold: number;
  ordersEnabled: boolean;
  /** بصمة الأصناف التي سُعِّرت — تُضاف محليًا لا من الخادم */
  signature?: string;
};

/**
 * صفحة السلة.
 *
 * السلة تُخزَّن محليًا كمعرّفات فقط، فأول ما تفعله هذه الصفحة هو طلب
 * تسعيرها من الخادم. أي فرق — سعر تغيّر، منتج نفد، كمية غير متاحة — يظهر
 * كتنبيه ويُصحَّح في التخزين المحلي تلقائيًا، فلا يفاجأ العميل عند الدفع.
 */
export function CartView() {
  const lines = useCart((state) => state.lines);
  const hydrated = useCart((state) => state.hydrated);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [failed, setFailed] = useState(false);

  // بصمة الأصناف الحالية — نقارنها بما سعّره الخادم لنشتق «قيد التحديث»
  // بدل مزامنة علم تحميل داخل useEffect
  const signature = lines
    .map((line) => `${line.variantId}:${line.quantity}`)
    .join('|');

  // نمنع تكرار تنبيه المشاكل نفسها عند كل إعادة تحقق
  const reportedIssues = useRef<string>('');

  /** يوائم التخزين المحلي مع ما قرره الخادم */
  const applyIssues = useCallback(
    (issues: CartIssue[]) => {
      if (issues.length === 0) {
        reportedIssues.current = '';
        return;
      }

      const fingerprint = issues
        .map((issue) => `${issue.type}:${issue.variantId}`)
        .join('|');

      for (const issue of issues) {
        if (issue.type === 'removed' || issue.type === 'out_of_stock') {
          remove(issue.variantId);
        } else if (issue.type === 'quantity_reduced') {
          setQuantity(issue.variantId, issue.available);
        }
      }

      if (fingerprint !== reportedIssues.current) {
        reportedIssues.current = fingerprint;
        toast.info('تم تحديث السلة حسب المخزون المتوفر');
      }
    },
    [remove, setQuantity],
  );

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;

    let alive = true;

    (async () => {
      try {
        const response = await fetch('/api/cart/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines }),
        });

        if (!response.ok) throw new Error('validate failed');

        const data = (await response.json()) as CartResponse;
        if (!alive) return;

        setCart({ ...data, signature });
        setFailed(false);
        applyIssues(data.issues);
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
    // `signature` يمثّل محتوى `lines` تمثيلًا كاملًا
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, signature, applyIssues]);

  // «قيد التحديث» = ما سعّره الخادم لا يطابق محتوى السلة الحالي
  const loading = cart?.signature !== signature && !failed;

  // السلة الفارغة حالة مشتقّة بالكامل — لا نحتاج انتظار الخادم لعرضها
  if (hydrated && lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={40} />}
        title="سلّتك فارغة"
        description="أضف عطرًا إلى السلة لتبدأ طلبك."
        action={{ href: '/products', label: 'تصفّح العطور' }}
      />
    );
  }

  if (!hydrated || (!cart && !failed)) {
    return <CartSkeleton />;
  }

  if (failed && !cart) {
    return (
      <EmptyState
        icon={<TriangleAlert size={40} />}
        title="تعذّر تحميل السلة"
        description="تحقّق من اتصالك بالإنترنت ثم أعد المحاولة."
        action={{ href: '/cart', label: 'إعادة المحاولة' }}
      />
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={40} />}
        title="سلّتك فارغة"
        description="أضف عطرًا إلى السلة لتبدأ طلبك."
        action={{ href: '/products', label: 'تصفّح العطور' }}
      />
    );
  }

  const money = (minor: number) =>
    formatMoney(minor, {
      currency: cart.currency.symbol,
      decimals: cart.currency.decimals,
    });

  const remainingForFreeDelivery =
    cart.freeDeliveryThreshold > 0
      ? cart.freeDeliveryThreshold - cart.subtotal
      : 0;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
      {/* ── الأصناف ── */}
      <div className={cn('space-y-3', loading && 'opacity-60')}>
        <AnimatePresence initial={false}>
          {cart.items.map((item) => (
            <motion.article
              key={item.variantId}
              layout
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card flex gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4"
            >
              <Link
                href={`/product/${item.productSlug}`}
                className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-sunken)] sm:h-28 sm:w-24"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center font-display text-2xl text-[var(--text-muted)]/30"
                    aria-hidden
                  >
                    M
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="line-clamp-2 text-sm font-semibold underline-offset-4 hover:text-[var(--accent)] hover:underline sm:text-base"
                    >
                      {item.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {item.variantLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      remove(item.variantId);
                      toast.info('أُزيل من السلة');
                    }}
                    aria-label={`حذف ${item.productName} من السلة`}
                    className="tap-target -me-2 -mt-2 flex shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>

                {item.stockLevel === 'low_stock' ? (
                  <p className="mt-1 text-[0.7rem] text-[var(--color-warning)]">
                    {STOCK_LEVEL_LABELS.low_stock} — بقي {item.stock}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                  <div className="flex items-center rounded-full border border-[var(--surface-border)]">
                    <QtyButton
                      label="إنقاص"
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        setQuantity(item.variantId, item.quantity - 1)
                      }
                    >
                      <Minus size={14} aria-hidden />
                    </QtyButton>

                    <span className="tabular w-10 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>

                    <QtyButton
                      label="زيادة"
                      disabled={item.quantity >= item.maxQuantity}
                      onClick={() =>
                        setQuantity(item.variantId, item.quantity + 1)
                      }
                    >
                      <Plus size={14} aria-hidden />
                    </QtyButton>
                  </div>

                  <div className="text-end">
                    <p className="tabular text-base font-semibold text-[var(--accent)]">
                      {money(item.lineTotal)}
                    </p>
                    {item.quantity > 1 ? (
                      <p className="tabular text-[0.7rem] text-[var(--text-muted)]">
                        {money(item.unitPrice)} للقطعة
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {/* ── الملخّص ── */}
      <aside className="mt-8 lg:sticky lg:top-28 lg:mt-0">
        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">ملخّص الطلب</h2>
          <div className="my-4 h-px rule-gold" />

          <dl className="space-y-3 text-sm">
            <Row label={`المجموع (${cart.itemCount} قطعة)`}>
              {money(cart.subtotal)}
            </Row>

            {cart.savings > 0 ? (
              <Row label="وفّرت" tone="success">
                {money(cart.savings)}
              </Row>
            ) : null}

            <Row label="التوصيل" muted>
              يُحتسب عند إتمام الطلب
            </Row>
          </dl>

          <div className="my-4 h-px bg-[var(--surface-border)]" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">الإجمالي</span>
            <span className="tabular text-xl font-semibold text-[var(--accent)]">
              {money(cart.subtotal)}
            </span>
          </div>

          <p className="mt-1 text-[0.7rem] text-[var(--text-muted)]">
            قبل إضافة رسوم التوصيل
          </p>

          {remainingForFreeDelivery > 0 ? (
            <p className="mt-3 rounded-lg bg-[var(--accent)]/10 p-3 text-xs text-[var(--accent)]">
              أضف {money(remainingForFreeDelivery)} للحصول على توصيل مجاني
            </p>
          ) : null}

          {cart.ordersEnabled ? (
            <Link
              href="/checkout"
              className="tap-target mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-300 hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-glow)] active:scale-[0.98]"
            >
              متابعة إتمام الطلب
            </Link>
          ) : (
            <p className="mt-5 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-center text-xs text-[var(--color-warning)]">
              استقبال الطلبات متوقّف مؤقتًا
            </p>
          )}

          <Link
            href="/products"
            className="mt-3 block text-center text-xs text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
          >
            متابعة التسوّق
          </Link>

          {loading ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-[0.7rem] text-[var(--text-muted)]">
              <Loader2 size={12} className="animate-spin" aria-hidden />
              جارٍ تحديث الأسعار…
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  children,
  tone,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'success';
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd
        className={cn(
          'tabular text-end',
          tone === 'success' && 'text-[var(--color-success)]',
          muted && 'text-xs text-[var(--text-muted)]',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function QtyButton({
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

function CartSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
      <div className="space-y-3">
        {[0, 1].map((index) => (
          <div key={index} className="surface-card flex gap-4 p-4">
            <Skeleton className="h-28 w-24 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card mt-8 space-y-4 p-6 lg:mt-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
