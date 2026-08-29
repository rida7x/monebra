import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // يثبّت جذر Turbopack على مجلد المشروع — بدونه يصعد إلى مجلد المستخدم
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  poweredByHeader: false,
  compress: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 384],
    remotePatterns: [],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],

    /**
     * البناء بعامل واحد — لأجل حدّ اتصالات Supabase.
     *
     * ⚠️ Next يوزّع توليد الصفحات على عمّال بعدد أنوية المعالج (١٢ هنا)،
     * وكل عامل يفتح اتصاله بالقاعدة. و Session pooler على الخطة المجانية
     * يقبل ١٥ عميلًا فقط، فيفشل البناء بـ:
     *   `(EMAXCONNSESSION) max clients reached in session mode`
     * وهو خطأ يظهر **على جهاز التاجر وعلى Netlify معًا**، ويتغيّر بعدد
     * أنوية الجهاز — أي أنه ينجح عند مبرمج ويفشل عند آخر بلا سبب ظاهر.
     *
     * رفع الحدّ الأدنى للصفحات لكل عامل فوق عدد صفحات المتجر كلها يضمن
     * عاملًا واحدًا: اتصال واحد مهما كان الجهاز. المتجر صغير (عشرات
     * الصفحات) فالبناء يبقى في حدود الدقائق.
     *
     * لو كبر الكتالوج حتى صار البناء بطيئًا: ارفع `pool_size` من لوحة
     * Supabase أولًا، ثم أنقص هذا الرقم — بهذا الترتيب لا العكس.
     */
    staticGenerationMinPagesPerWorker: 1000,

    // محاولة إضافية لكل صفحة تفشل: أخطاء الشبكة العابرة إلى Supabase لا
    // ينبغي أن تُسقط نشرًا كاملًا
    staticGenerationRetryCount: 1,
  },

  async headers() {
    /**
     * سياسة أمان المحتوى (CSP).
     *
     * `'unsafe-inline'` في `script-src` ضروري لـ Next: يحقن سكربتات
     * التهيئة مضمّنة. البديل (nonce لكل طلب) يمنع التوليد الثابت للصفحات
     * ويُبطئ المتجر على الشبكات الضعيفة — وهو ثمن أكبر من الفائدة هنا،
     * خصوصًا أننا لا نعرض أي محتوى يكتبه مستخدم كـ HTML خام.
     *
     * `connect-src 'self'` وحده: المتجر لا يتصل بأي جهة خارجية، ولو حاول
     * سكربت مسروق إرسال بيانات لخادم بعيد لمنعه المتصفح.
     *
     * `'unsafe-eval'` في التطوير فقط: يحتاجه React Refresh لإعادة التحميل
     * الساخن. في الإنتاج لا يحتاجه Next، وإبقاؤه يفتح للمهاجم بابًا لتحويل
     * نص إلى كود — فنُسقطه.
     */
    const isDev = process.env.NODE_ENV === 'development';

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // يفرض HTTPS لسنة كاملة — يعمل فقط عند تقديم الموقع عبر HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        // صفحات اللوحة والطلبات لا تُخزَّن في أي وسيط
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
