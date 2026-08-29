'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Loader2,
  Check,
  ExternalLink,
  Upload,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  Field,
  FormSection,
  Toggle,
  inputClass,
  textareaClass,
} from '@/components/admin/form';
import { cn } from '@/lib/utils';

type ContentPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
};

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  mediaUrl: string | null;
  mediaType: string;
  ctaText: string | null;
  ctaLink: string | null;
  ctaText2: string | null;
  ctaLink2: string | null;
  isActive: boolean;
};

/**
 * إدارة محتوى المتجر.
 *
 * يشمل الشريحة الرئيسية وصفحات السياسات — كل ما يقرأه العميل ولا يخصّ
 * منتجًا بعينه. التعديل هنا ينعكس على المتجر فورًا عبر إبطال الذاكرة
 * المؤقتة.
 */
export function ContentManager({
  hero,
  pages,
}: {
  hero: HeroSlide | null;
  pages: ContentPage[];
}) {
  return (
    <div className="space-y-6">
      <HeroEditor hero={hero} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">صفحات المتجر</h2>

        <div className="space-y-3">
          {pages.map((page) => (
            <PageEditor key={page.id} page={page} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────── الشريحة الرئيسية ───────────────────────────

function HeroEditor({ hero }: { hero: HeroSlide | null }) {
  const router = useRouter();

  const [title, setTitle] = useState(hero?.title ?? '');
  const [subtitle, setSubtitle] = useState(hero?.subtitle ?? '');
  const [mediaUrl, setMediaUrl] = useState(hero?.mediaUrl ?? '');
  const [mediaType, setMediaType] = useState(hero?.mediaType ?? 'image');
  const [ctaText, setCtaText] = useState(hero?.ctaText ?? '');
  const [ctaLink, setCtaLink] = useState(hero?.ctaLink ?? '');
  const [ctaText2, setCtaText2] = useState(hero?.ctaText2 ?? '');
  const [ctaLink2, setCtaLink2] = useState(hero?.ctaLink2 ?? '');
  const [isActive, setIsActive] = useState(hero?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadMedia(file: File) {
    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: form,
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? 'تعذّر رفع الصورة');
        return;
      }

      setMediaUrl(data.url);
      setMediaType('image');
      setSaved(false);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'hero',
          id: hero?.id,
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          mediaUrl: mediaUrl || null,
          mediaType,
          ctaText: ctaText.trim() || null,
          ctaLink: ctaLink.trim() || null,
          ctaText2: ctaText2.trim() || null,
          ctaLink2: ctaLink2.trim() || null,
          isActive,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر الحفظ');
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <FormSection
        title="الشريحة الرئيسية"
        description="أول ما يراه العميل عند فتح المتجر"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="العنوان" htmlFor="heroTitle" required>
              <input
                id="heroTitle"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaved(false);
                }}
                maxLength={120}
                className={inputClass}
              />
            </Field>

            <Field label="العبارة تحته" htmlFor="heroSubtitle">
              <input
                id="heroSubtitle"
                value={subtitle}
                onChange={(event) => {
                  setSubtitle(event.target.value);
                  setSaved(false);
                }}
                maxLength={200}
                className={inputClass}
              />
            </Field>
          </div>

          {/* ── الخلفية ── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
              صورة الخلفية
            </p>

            {mediaUrl ? (
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-36 overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-sunken)]">
                  <Image
                    src={mediaUrl}
                    alt="خلفية الواجهة"
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setSaved(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--color-danger)]"
                >
                  <X size={13} aria-hidden />
                  إزالة
                </button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--surface-border-strong)] px-4 py-3 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Upload size={14} aria-hidden />
                )}
                رفع صورة
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadMedia(file);
                  }}
                />
              </label>
            )}

            <p className="mt-2 text-xs text-[var(--text-muted)]">
              بلا صورة يظهر تدرّج ذهبي أنيق على الخلفية الداكنة.
            </p>
          </div>

          {/* ── الأزرار ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نص الزر الأول" htmlFor="ctaText">
              <input
                id="ctaText"
                value={ctaText}
                onChange={(event) => {
                  setCtaText(event.target.value);
                  setSaved(false);
                }}
                placeholder="تسوّق الآن"
                maxLength={60}
                className={inputClass}
              />
            </Field>

            <Field
              label="رابط الزر الأول"
              htmlFor="ctaLink"
              hint="رابط داخلي يبدأ بـ / مثل /products"
            >
              <input
                id="ctaLink"
                value={ctaLink}
                onChange={(event) => {
                  setCtaLink(event.target.value);
                  setSaved(false);
                }}
                dir="ltr"
                placeholder="/products"
                maxLength={200}
                className={`${inputClass} text-start`}
              />
            </Field>

            <Field label="نص الزر الثاني" htmlFor="ctaText2">
              <input
                id="ctaText2"
                value={ctaText2}
                onChange={(event) => {
                  setCtaText2(event.target.value);
                  setSaved(false);
                }}
                maxLength={60}
                className={inputClass}
              />
            </Field>

            <Field label="رابط الزر الثاني" htmlFor="ctaLink2">
              <input
                id="ctaLink2"
                value={ctaLink2}
                onChange={(event) => {
                  setCtaLink2(event.target.value);
                  setSaved(false);
                }}
                dir="ltr"
                placeholder="/products?best=1"
                maxLength={200}
                className={`${inputClass} text-start`}
              />
            </Field>
          </div>

          <Toggle
            label="الشريحة ظاهرة"
            checked={isActive}
            onChange={(value) => {
              setIsActive(value);
              setSaved(false);
            }}
          />

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : null}
              حفظ الشريحة
            </button>

            {saved ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]"
              >
                <Check size={13} aria-hidden />
                حُفظت
              </span>
            ) : null}

            <Link
              href="/"
              target="_blank"
              className="ms-auto inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
            >
              <ExternalLink size={13} aria-hidden />
              معاينة
            </Link>
          </div>
        </div>
      </FormSection>
    </form>
  );
}

// ─────────────────────────── صفحات المحتوى ───────────────────────────

function PageEditor({ page }: { page: ContentPage }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [isActive, setIsActive] = useState(page.isActive);
  const [metaTitle, setMetaTitle] = useState(page.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(
    page.metaDescription ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlaceholder = page.body.includes('⚠️ هذا نص افتراضي');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'page',
          id: page.id,
          title: title.trim(),
          body: body.trim(),
          isActive,
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر الحفظ');
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {page.title}
            {isPlaceholder ? (
              <span className="rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--color-warning)]">
                نص افتراضي — عدّله قبل الإطلاق
              </span>
            ) : null}
            {!page.isActive ? (
              <span className="rounded-full bg-[var(--text-muted)]/15 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--text-muted)]">
                مخفية
              </span>
            ) : null}
          </p>

          <p dir="ltr" className="mt-0.5 text-start text-xs text-[var(--text-muted)]">
            /pages/{page.slug}
          </p>
        </div>

        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <form
          onSubmit={save}
          className="border-t border-[var(--surface-border)] p-4 sm:p-5"
        >
          <div className="space-y-4">
            <Field label="العنوان" htmlFor={`title-${page.id}`} required>
              <input
                id={`title-${page.id}`}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaved(false);
                }}
                maxLength={160}
                className={inputClass}
              />
            </Field>

            <Field
              label="النص"
              htmlFor={`body-${page.id}`}
              required
              hint="تُحترم فواصل الأسطر كما تكتبها"
            >
              <textarea
                id={`body-${page.id}`}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setSaved(false);
                }}
                rows={10}
                maxLength={20_000}
                className={textareaClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان الصفحة للسيو" htmlFor={`metaTitle-${page.id}`}>
                <input
                  id={`metaTitle-${page.id}`}
                  value={metaTitle}
                  onChange={(event) => {
                    setMetaTitle(event.target.value);
                    setSaved(false);
                  }}
                  maxLength={160}
                  className={inputClass}
                />
              </Field>

              <Field label="وصف الصفحة للسيو" htmlFor={`metaDesc-${page.id}`}>
                <input
                  id={`metaDesc-${page.id}`}
                  value={metaDescription}
                  onChange={(event) => {
                    setMetaDescription(event.target.value);
                    setSaved(false);
                  }}
                  maxLength={300}
                  className={inputClass}
                />
              </Field>
            </div>

            <Toggle
              label="ظاهرة في التذييل"
              checked={isActive}
              onChange={(value) => {
                setIsActive(value);
                setSaved(false);
              }}
            />

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : null}
                حفظ
              </button>

              {saved ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]"
                >
                  <Check size={13} aria-hidden />
                  حُفظت
                </span>
              ) : null}

              <Link
                href={`/pages/${page.slug}`}
                target="_blank"
                className="ms-auto inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
              >
                <ExternalLink size={13} aria-hidden />
                معاينة
              </Link>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
