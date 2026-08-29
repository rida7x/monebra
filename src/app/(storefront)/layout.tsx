import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getActiveCategories } from '@/lib/services/catalog';
import { Header, type NavLink } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { WhatsAppFab } from '@/components/layout/WhatsAppFab';
import { Toaster } from '@/components/ui/Toaster';
import { PageTracker } from '@/components/analytics/Tracker';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { SiteSchema } from '@/components/seo/SiteSchema';

/**
 * تخطيط واجهة المتجر.
 *
 * الأسطح الداكنة هي الافتراضية على `:root`، ويقلبها الزائر إلى النهاري عبر
 * `data-theme="light"` على <html> من زر التبديل في الرأس. لوحة التحكم تضع
 * `data-surface="admin"` على عنصر داخلي فتبقى فاتحة في الحالتين.
 *
 * الحشوة السفلية `pb-20 lg:pb-0` تترك مساحة لشريط التنقل السفلي على
 * الهاتف حتى لا يغطي آخر عنصر في الصفحة.
 */
export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, categories, pages] = await Promise.all([
    getSettings(),
    getActiveCategories(),
    prisma.contentPage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { title: true, slug: true },
    }),
  ]);

  // التنقل يُبنى من التصنيفات الموجودة فعلًا — لا روابط ثابتة في الكود
  const navLinks: NavLink[] = [
    { label: 'كل العطور', href: '/products' },
    ...categories
      .filter((category) => category.productCount > 0)
      .slice(0, 5)
      .map((category) => ({
        label: category.name,
        href: `/category/${category.slug}`,
      })),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteSchema />

      <Header
        storeName={settings.storeName}
        logoUrl={settings.logoUrl}
        logoUrlLight={settings.logoUrlLight}
        links={navLinks}
        announcement={settings.announcementBar}
      />

      <div className="flex-1 pb-20 lg:pb-0">{children}</div>

      <Footer
        settings={settings}
        categories={categories.filter((c) => c.productCount > 0)}
        pages={pages}
      />

      <MobileTabBar />
      <WhatsAppFab
        number={settings.whatsappNumber}
        storeName={settings.storeName}
      />
      <Toaster />
      <PageTracker />
      <ServiceWorkerRegistrar />
    </div>
  );
}
