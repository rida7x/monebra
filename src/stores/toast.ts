'use client';

import { create } from 'zustand';

/**
 * تنبيهات قصيرة (Toasts).
 *
 * تُستخدم لتأكيد الإجراءات — «تمت إضافة العطر إلى السلة» — ولعرض أخطاء
 * مفهومة للمستخدم. لا تعرض أبدًا نصوص أخطاء تقنية أو Stack Trace.
 */

export type ToastTone = 'success' | 'error' | 'info';

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  /** رابط اختياري يظهر كزر داخل التنبيه — «عرض السلة» مثلًا */
  action?: { label: string; href: string };
};

type ToastState = {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

const DURATION = 3500;
const MAX_VISIBLE = 3;

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],

  show: (toast) => {
    const id = nextId++;

    set({ toasts: [...get().toasts, { ...toast, id }].slice(-MAX_VISIBLE) });

    if (typeof window !== 'undefined') {
      window.setTimeout(() => get().dismiss(id), DURATION);
    }
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** اختصارات — تُستدعى من أي مكان بلا hook */
export const toast = {
  success: (message: string, action?: Toast['action']) =>
    useToasts.getState().show({ message, tone: 'success', action }),
  error: (message: string) =>
    useToasts.getState().show({ message, tone: 'error' }),
  info: (message: string, action?: Toast['action']) =>
    useToasts.getState().show({ message, tone: 'info', action }),
};
