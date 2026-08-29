'use client';

import { useEffect, useState } from 'react';
import { Heart, TriangleAlert, Trash2 } from 'lucide-react';
import { useWishlist } from '@/stores/wishlist';
import { toast } from '@/stores/toast';
import { ProductGrid } from '@/components/product/ProductCard';
import {
  EmptyState,
  ProductGridSkeleton,
} from '@/components/ui/primitives';
import type { ProductCardData } from '@/lib/services/catalog';

type Response = {
  products: ProductCardData[];
  currency: { symbol: string; decimals: number };
  /** بصمة المعرّفات التي جُلبت — تُضاف محليًا لا من الخادم */
  signature?: string;
};

/**
 * صفحة المفضلة.
 *
 * تُخزَّن المعرّفات محليًا فقط، فنطلب بياناتها الحالية من الخادم عند كل
 * فتح. إذا حذف المدير منتجًا فلن يعود في النتيجة، وننظّف التخزين المحلي
 * منه تلقائيًا حتى لا يبقى معرّف ميت إلى الأبد.
 */
export function WishlistView() {
  const ids = useWishlist((state) => state.ids);
  const hydrated = useWishlist((state) => state.hydrated);
  const remove = useWishlist((state) => state.remove);
  const clear = useWishlist((state) => state.clear);

  const [data, setData] = useState<Response | null>(null);
  const [failed, setFailed] = useState(false);

  const signature = ids.join('|');

  useEffect(() => {
    if (!hydrated || ids.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/products/by-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!response.ok) throw new Error('failed');

        const payload = (await response.json()) as Response;
        if (cancelled) return;

        setData({ ...payload, signature });
        setFailed(false);

        // تنظيف المعرّفات التي لم تعد موجودة — منتج حذفه المدير أو أخفاه
        const alive = new Set(payload.products.map((product) => product.id));
        for (const id of ids) {
          if (!alive.has(id)) remove(id);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `signature` يمثّل `ids` تمثيلًا كاملًا، و`remove` مستقر من zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, signature]);

  // القائمة الفارغة حالة مشتقّة — لا حاجة لانتظار الخادم
  if (hydrated && ids.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={40} />}
        title="لا توجد عطور في المفضلة"
        description="اضغط على أيقونة القلب في أي عطر لحفظه هنا والرجوع إليه لاحقًا."
        action={{ href: '/products', label: 'تصفّح العطور' }}
      />
    );
  }

  if (!hydrated || (!data && !failed)) {
    return <ProductGridSkeleton count={4} />;
  }

  if (failed && !data) {
    return (
      <EmptyState
        icon={<TriangleAlert size={40} />}
        title="تعذّر تحميل المفضلة"
        description="تحقّق من اتصالك بالإنترنت ثم أعد المحاولة."
        action={{ href: '/wishlist', label: 'إعادة المحاولة' }}
      />
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={40} />}
        title="لا توجد عطور في المفضلة"
        description="اضغط على أيقونة القلب في أي عطر لحفظه هنا والرجوع إليه لاحقًا."
        action={{ href: '/products', label: 'تصفّح العطور' }}
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {data.products.length}
          </span>{' '}
          عطر محفوظ
        </p>

        <button
          type="button"
          onClick={() => {
            clear();
            toast.info('تم إفراغ المفضلة');
          }}
          className="tap-target flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-4 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
        >
          <Trash2 size={13} aria-hidden />
          إفراغ المفضلة
        </button>
      </div>

      <ProductGrid products={data.products} currency={data.currency} />
    </>
  );
}
