import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';

/**
 * بيان التطبيق (PWA).
 *
 * يُبنى من الإعدادات فيحمل اسم المتجر وشعاره الفعليين — فإذا غيّر المدير
 * الاسم تغيّر اسم التطبيق على شاشة الهاتف تلقائيًا.
 *
 * `display: standalone` يفتح المتجر بلا شريط عنوان المتصفح فيبدو كتطبيق.
 * `dir: rtl` و`lang: ar` يضمنان اتجاهًا صحيحًا في شاشة البدء.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();

  return {
    name: settings.storeName,
    short_name: settings.storeName.split(' ')[0] ?? settings.storeName,
    description: settings.storeTagline || settings.metaDescription || undefined,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#08080a',
    theme_color: '#08080a',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'كل العطور', url: '/products' },
      { name: 'سلة التسوق', url: '/cart' },
      { name: 'تتبّع طلبك', url: '/track' },
    ],
  };
}
