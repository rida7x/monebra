'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/components/analytics/Tracker';

/**
 * يسجّل مشاهدة منتج مرة واحدة لكل زيارة.
 *
 * مكوّن عميل صغير معزول حتى تبقى صفحة المنتج كلها Server Component —
 * لا نحوّلها إلى مكوّن عميل لأجل حدث واحد.
 *
 * `useRef` يمنع التكرار عند إعادة التصيير في الوضع الصارم للتطوير، وإلا
 * ظهرت كل مشاهدة مرتين في الإحصائيات.
 */
export function ProductViewTracker({ productId }: { productId: string }) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === productId) return;
    sent.current = productId;

    track('product_view', { productId });
  }, [productId]);

  return null;
}
