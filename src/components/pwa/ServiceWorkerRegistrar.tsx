'use client';

import { useEffect } from 'react';

/**
 * تسجيل Service Worker.
 *
 * في وضع التطوير لا نسجّله — بل نُلغي أي تسجيل سابق: الملف المخزّن يعرض
 * نسخة قديمة من الصفحة بعد كل تعديل ويضيّع وقتًا في مطاردة أخطاء وهمية.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            void registration.unregister();
          }
        })
        .catch(() => undefined);
      return;
    }

    // بعد التحميل الكامل حتى لا ينافس تسجيلُه تحميلَ الصفحة نفسها
    const register = () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
