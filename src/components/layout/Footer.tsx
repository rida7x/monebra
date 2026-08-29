import Link from 'next/link';
import { Phone, MapPin, Clock } from 'lucide-react';
import {
  TikTokIcon,
  InstagramIcon,
  FacebookIcon,
  WhatsAppIcon,
} from '@/components/ui/BrandIcons';
import type { StoreSettings } from '@/lib/settings';
import { whatsappLink } from '@/lib/settings';
import { formatPhone } from '@/lib/utils';
import { BrandLogo } from '@/components/layout/BrandLogo';

/**
 * تذييل الموقع — Server Component، بلا JavaScript.
 *
 * كل رابط وكل رقم يأتي من الإعدادات. الحقول الفارغة لا تُعرض أصلًا، فلا
 * يظهر للعميل رابط ميت ولا أيقونة لا تعمل قبل أن يملأ المدير بياناته.
 */
export function Footer({
  settings,
  categories,
  pages,
}: {
  settings: StoreSettings;
  categories: { name: string; slug: string }[];
  pages: { title: string; slug: string }[];
}) {
  const whatsapp = whatsappLink(settings.whatsappNumber);
  const year = new Date().getFullYear();

  const socials = [
    settings.tiktokUrl && {
      href: settings.tiktokUrl,
      label: 'TikTok',
      icon: TikTokIcon,
    },
    settings.instagramUrl && {
      href: settings.instagramUrl,
      label: 'Instagram',
      icon: InstagramIcon,
    },
    settings.facebookUrl && {
      href: settings.facebookUrl,
      label: 'Facebook',
      icon: FacebookIcon,
    },
    whatsapp && {
      href: whatsapp,
      label: 'WhatsApp',
      icon: WhatsAppIcon,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof TikTokIcon;
  }[];

  return (
    <footer className="mt-20 border-t border-[var(--surface-border)] bg-[var(--surface-sunken)]">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* ── العلامة ── */}
          <div className="lg:col-span-1">
            <BrandLogo
              storeName={settings.storeName}
              logoUrl={settings.logoUrl}
              logoUrlLight={settings.logoUrlLight}
              width={150}
              height={40}
              className="h-9 w-auto object-contain"
              fallbackClassName="font-display text-2xl tracking-wide text-gold-gradient"
            />

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
              {settings.storeTagline}
            </p>

            {socials.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {socials.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="tap-target flex items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)] transition-all duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Icon size={17} aria-hidden />
                    </a>
                  );
                })}
              </div>
            ) : null}

            {settings.tiktokUrl ? (
              <a
                href={settings.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-target mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 px-5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
              >
                <TikTokIcon size={14} aria-hidden />
                شاهدنا على TikTok
              </a>
            ) : null}
          </div>

          {/* ── التصنيفات ── */}
          {categories.length > 0 ? (
            <FooterColumn title="تسوّق">
              {categories.slice(0, 6).map((category) => (
                <FooterLink
                  key={category.slug}
                  href={`/category/${category.slug}`}
                >
                  {category.name}
                </FooterLink>
              ))}
              <FooterLink href="/products">كل العطور</FooterLink>
            </FooterColumn>
          ) : null}

          {/* ── الصفحات ── */}
          <FooterColumn title="المتجر">
            {pages.map((page) => (
              <FooterLink key={page.slug} href={`/pages/${page.slug}`}>
                {page.title}
              </FooterLink>
            ))}
            <FooterLink href="/track">تتبّع طلبك</FooterLink>
          </FooterColumn>

          {/* ── التواصل ── */}
          <FooterColumn title="تواصل معنا">
            {settings.phonePrimary ? (
              <FooterInfo icon={Phone}>
                <a
                  href={`tel:${settings.phonePrimary}`}
                  className="tabular transition-colors hover:text-[var(--accent)]"
                  dir="ltr"
                >
                  {formatPhone(settings.phonePrimary)}
                </a>
              </FooterInfo>
            ) : null}

            {whatsapp ? (
              <FooterInfo icon={WhatsAppIcon}>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  تواصل عبر واتساب
                </a>
              </FooterInfo>
            ) : null}

            {settings.addressText ? (
              <FooterInfo icon={MapPin}>{settings.addressText}</FooterInfo>
            ) : null}

            {settings.workingHours ? (
              <FooterInfo icon={Clock}>{settings.workingHours}</FooterInfo>
            ) : null}
          </FooterColumn>
        </div>

        {/* ── إخلاء المسؤولية ── */}
        <div className="mt-12 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-base)] p-5">
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            {settings.inspiredDisclaimer}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-8 text-xs text-[var(--text-muted)] sm:flex-row">
          <p>
            © {year} {settings.storeName}. جميع الحقوق محفوظة.
          </p>
          {settings.footerNote ? <p>{settings.footerNote}</p> : null}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterInfo({
  icon: Icon,
  children,
}: {
  icon: (props: { size?: number; className?: string }) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
      <Icon size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

