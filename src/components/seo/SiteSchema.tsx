import { getSettings } from '@/lib/settings';

/**
 * البيانات المنظّمة على مستوى الموقع كله.
 *
 * صفحة المنتج تصف نفسها بـ `Product`، لكن لا شيء كان يصف **المتجر**. هذه
 * تسدّ ذلك بنوعين:
 *
 *   • `Organization` — يربط جوجل اسم المتجر بشعاره وهاتفه وحساباته على
 *     تيك توك وإنستغرام، فتظهر لوحة المعرفة عند البحث عن «مونيبرا» بدل
 *     نتيجة نصية عادية.
 *   • `WebSite` مع `SearchAction` — يتيح مربع بحث داخل نتيجة جوجل يقود
 *     مباشرة إلى `/search` في المتجر.
 *
 * كل القيم من الإعدادات: لا رقم هاتف ولا رابط ثابت في الكود. والحقول
 * الفارغة تُحذف بدل إرسال سلاسل فارغة — بيانات منظّمة ناقصة أفضل من بيانات
 * كاذبة، وجوجل يتجاهل النوع كله أحيانًا بسبب حقل فارغ واحد.
 */
export async function SiteSchema() {
  const settings = await getSettings();
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');

  // في وضع الصيانة لا نصف متجرًا مغلقًا لمحركات البحث
  if (settings.maintenanceMode) return null;

  const socials = [
    settings.tiktokUrl,
    settings.instagramUrl,
    settings.facebookUrl,
  ].filter(Boolean);

  const phones = [settings.phonePrimary, settings.whatsappNumber].filter(Boolean);

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: settings.storeName,
    url: siteUrl,
    ...(settings.storeTagline ? { description: settings.storeTagline } : {}),
    ...(settings.logoUrl ? { logo: `${siteUrl}${settings.logoUrl}` } : {}),
    ...(socials.length > 0 ? { sameAs: socials } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(phones.length > 0
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            telephone: phones[0],
            areaServed: 'LY',
            availableLanguage: ['ar'],
          },
        }
      : {}),
    ...(settings.addressText
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: settings.addressText,
            addressCountry: 'LY',
          },
        }
      : {}),
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: settings.storeName,
    inLanguage: 'ar-LY',
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([organization, website]),
      }}
    />
  );
}
