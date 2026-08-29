/**
 * Service Worker لمتجر Monebra.
 *
 * الاستراتيجية مقصودة ومحافِظة — متجر يبيع فعليًا لا يحتمل عرض بيانات
 * قديمة:
 *
 *   • **لا نخزّن أي طلب POST ولا أي مسار /api** — الأسعار والمخزون
 *     والطلبات يجب أن تكون لحظية دائمًا. تخزينها يعني عرض سعر قديم أو
 *     منتج نفد على أنه متوفر.
 *   • **لا نخزّن /admin** — بيانات إدارية حساسة لا مكان لها في ذاكرة
 *     المتصفح.
 *   • الأصول الثابتة (الخطوط، الصور، ملفات البناء) بـ cache-first —
 *     أسماؤها تحمل بصمة المحتوى فلا تتغير أبدًا لنفس الاسم.
 *   • الصفحات بـ network-first مع رجوع إلى صفحة «لا يوجد اتصال» — على
 *     شبكة ضعيفة يرى العميل صفحة مصمّمة بدل خطأ المتصفح.
 */

const VERSION = 'v1';
const STATIC_CACHE = `monebra-static-${VERSION}`;
const PAGE_CACHE = `monebra-pages-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // نتعامل مع نطاقنا فقط
  if (url.origin !== self.location.origin) return;

  // لا تخزين لواجهات البرمجة ولا للوحة التحكم — انظر الشرح أعلاه
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // ── الأصول الثابتة: cache-first ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/uploads/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // ── الصفحات: network-first مع رجوع للنسخة المخزّنة ثم صفحة الانقطاع ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ??
            new Response('لا يوجد اتصال بالإنترنت', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }),
    );
  }
});
