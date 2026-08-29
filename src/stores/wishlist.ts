'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * المفضلة — تُحفظ في localStorage بلا تسجيل دخول.
 *
 * نحفظ `productId` فقط. عند فتح صفحة المفضلة نطلب بيانات هذه المنتجات من
 * الخادم، فتبقى الأسعار وحالة التوفر صحيحة دائمًا، ويختفي أي منتج حذفه
 * المدير أو أخفاه بدل أن يظهر برابط مكسور.
 *
 * عند إضافة حسابات العملاء لاحقًا، تُزامَن هذه القائمة مع جدول wishlists
 * دون تغيير أي واجهة.
 */

const MAX_WISHLIST = 100;

type WishlistState = {
  ids: string[];
  hydrated: boolean;

  setHydrated: () => void;
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      toggle: (productId) => {
        const ids = get().ids;

        if (ids.includes(productId)) {
          set({ ids: ids.filter((id) => id !== productId) });
          return false;
        }

        // الأحدث أولًا، مع سقف يمنع تضخم التخزين المحلي
        set({ ids: [productId, ...ids].slice(0, MAX_WISHLIST) });
        return true;
      },

      remove: (productId) =>
        set({ ids: get().ids.filter((id) => id !== productId) }),

      clear: () => set({ ids: [] }),
    }),
    {
      name: 'monebra-wishlist',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
