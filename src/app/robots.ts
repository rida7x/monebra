import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';

/**
 * قواعد الزحف.
 *
 * نمنع فهرسة كل ما يحمل بيانات شخصية أو لا قيمة له في نتائج البحث:
 * لوحة التحكم، واجهات البرمجة، السلة، المفضلة، إتمام الطلب، وصفحات
 * الطلبات (روابطها تحتوي رقم الطلب).
 *
 * وضع الصيانة يمنع الزحف كليًا حتى لا تُفهرس نسخة غير جاهزة.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

  const settings = await getSettings();

  if (settings.maintenanceMode) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/cart',
          '/checkout',
          '/wishlist',
          '/order/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
