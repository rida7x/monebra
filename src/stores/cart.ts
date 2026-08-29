'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from '@/lib/constants';

/**
 * سلة التسوق — حالة العميل فقط.
 *
 * ⚠️ قاعدة أمنية: السلة تحفظ `variantId` والكمية **فقط**. لا أسعار ولا
 * أسماء ولا إجماليات. كل بيانات العرض والحساب تأتي من الخادم عبر
 * `/api/cart/validate`، فلا يستطيع أحد تعديل سعر بتحرير localStorage.
 *
 * الفائدة الثانية: إذا غيّر المدير سعر منتج أو أخفاه، تعكس السلة التغيير
 * فورًا عند فتحها بدل عرض بيانات قديمة.
 */

export type CartLine = {
  variantId: string;
  quantity: number;
};

export type AddResult = 'added' | 'updated' | 'full';

type CartState = {
  lines: CartLine[];
  /** يصبح true بعد استرجاع الحالة من localStorage — يمنع وميض العدّاد */
  hydrated: boolean;

  setHydrated: () => void;
  add: (variantId: string, quantity?: number) => AddResult;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      add: (variantId, quantity = 1) => {
        const lines = get().lines;
        const existing = lines.find((line) => line.variantId === variantId);

        if (existing) {
          const next = Math.min(existing.quantity + quantity, MAX_ITEM_QUANTITY);
          set({
            lines: lines.map((line) =>
              line.variantId === variantId ? { ...line, quantity: next } : line,
            ),
          });
          return 'updated';
        }

        if (lines.length >= MAX_CART_LINES) return 'full';

        set({
          lines: [
            ...lines,
            { variantId, quantity: Math.min(quantity, MAX_ITEM_QUANTITY) },
          ],
        });
        return 'added';
      },

      setQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          set({
            lines: get().lines.filter((line) => line.variantId !== variantId),
          });
          return;
        }

        set({
          lines: get().lines.map((line) =>
            line.variantId === variantId
              ? { ...line, quantity: Math.min(quantity, MAX_ITEM_QUANTITY) }
              : line,
          ),
        });
      },

      remove: (variantId) =>
        set({
          lines: get().lines.filter((line) => line.variantId !== variantId),
        }),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'monebra-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/** مجموع القطع في السلة — مشتق، لا يُخزَّن */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
