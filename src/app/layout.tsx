import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Cormorant_Garamond, Cairo } from 'next/font/google';
import { getSettings } from '@/lib/settings';
import { THEME_COLORS, THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

/**
 * ⚠️ كل وزن هنا يكلّف ملفّين (عربي ولاتيني) ≈ 48 ك.ب، وكلها تُحمَّل مسبقًا
 * على **كل** صفحة. الخط الأثقل حِملًا على شبكة ضعيفة — وهو جمهور المتجر
 * الأساسي — فلا نضيف وزنًا ما لم يكن له أثر مرئي حقيقي.
 *
 * 300 للعنوان الرئيسي (الوزن الخفيف بحجم كبير = مظهر فاخر)، و400 للنص،
 * و600 للعناوين والأزرار، و700 للأرقام البارزة. الوزن 500 حُذف: فرقه عن
 * 400 و600 لا يكاد يُرى في النصوص الصغيرة التي كان يُستخدم فيها.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: true,
});

/** خط زخرفي للاتينية فقط، لا يُحمَّل مسبقًا. 500 كان بلا استخدام. */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
});

/**
 * Cairo — لشريط وعد المطابقة وحده.
 *
 * ⚠️ `preload: false` مقصود: الشريط يظهر في صفحات الأقسام فقط، وتحميله
 * مسبقًا على **كل** صفحة يضيف ≈٤٨ ك.ب لكل وزن على زائر لن يراه غالبًا —
 * وجمهور المتجر على شبكات هاتف ضعيفة. وزنان فقط لنفس السبب.
 */
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  // الاسم `-src` لأن `--font-cairo` في globals.css هو المكدّس الكامل مع
  // الاحتياطي، وتسميتهما واحدًا يجعل المتغيّر يشير إلى نفسه فيسقط الخط
  variable: '--font-cairo-src',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  /**
   * لون واحد لا استعلام وسائط: الوضع اختيار الزائر لا تفضيل نظامه، ويُحدَّث
   * هذا الوسم من سكربت الرأس ومن زر التبديل. القيمة هنا هي الافتراضي الداكن.
   */
  themeColor: THEME_COLORS.dark,
  /**
   * `color-scheme` يُضبط في CSS على `:root` و`[data-theme='light']` كي يتبع
   * الاختيار المحفوظ. تثبيته هنا على 'dark' كان يجعل حقول الإدخال وأشرطة
   * التمرير داكنة داخل الوضع النهاري.
   */
};

/**
 * البيانات الوصفية تُبنى من الإعدادات في قاعدة البيانات، فيستطيع المدير
 * تغيير اسم المتجر ووصفه من لوحة التحكم دون لمس الكود.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const title = settings.metaTitle || settings.storeName;
  const description = settings.metaDescription || settings.storeTagline;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${settings.storeName}`,
    },
    description,
    keywords: settings.metaKeywords || undefined,
    applicationName: settings.storeName,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ar_LY',
      siteName: settings.storeName,
      title,
      description,
      images: settings.ogImage ? [{ url: settings.ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: settings.ogImage ? [settings.ogImage] : undefined,
    },
    icons: {
      icon: settings.faviconUrl || '/icons/icon-192.png',
      apple: '/icons/apple-icon.png',
    },
    manifest: '/manifest.webmanifest',
    robots: {
      index: !settings.maintenanceMode,
      follow: !settings.maintenanceMode,
    },
    formatDetection: { telephone: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${cormorant.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* يضبط الوضع قبل أول رسم — بدونه تومض الصفحة الداكنة ثم تبيضّ */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
