'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Check, Upload, X } from 'lucide-react';
import {
  Field,
  FormSection,
  Toggle,
  inputClass,
  textareaClass,
} from '@/components/admin/form';
import { toMajor } from '@/lib/money';
import type { StoreSettings } from '@/lib/settings';

/**
 * إعدادات المتجر.
 *
 * كل حقل هنا يظهر مباشرة في واجهة العميل: اسم المتجر، أرقام التواصل،
 * روابط السوشيال، نصوص السياسات. الحقول الفارغة **لا تُعرض للعميل أصلًا**،
 * فلا يظهر رابط ميت ولا أيقونة لا تعمل قبل أن يملأها المدير.
 */
export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();

  const [values, setValues] = useState({
    ...settings,
    // العتبة تُعرض بالصيغة المألوفة وتُحوَّل على الخادم
    freeDeliveryThreshold: toMajor(settings.freeDeliveryThreshold),
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // المفتاح الجاري رفعه، لا مجرّد «يجري الرفع» — وإلا دار مؤشر التحميل
  // على كلا الشعارين معًا عند رفع أحدهما
  const [uploadingKey, setUploadingKey] = useState<LogoKey | null>(null);

  function set<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function uploadLogo(key: LogoKey, file: File) {
    setUploadingKey(key);
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
        setError(data.error ?? 'تعذّر رفع الشعار');
        return;
      }

      set(key, data.url);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setUploadingKey(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حفظ الإعدادات');
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
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          كل ما تعدّله هنا يظهر في المتجر مباشرة
        </p>

        <div className="flex items-center gap-3">
          {saved ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]"
            >
              <Check size={14} aria-hidden />
              حُفظت
            </span>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : null}
            حفظ الإعدادات
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* ═══════════ الهوية ═══════════ */}
        <FormSection title="هوية المتجر">
          <div className="space-y-4">
            <Field label="اسم المتجر" htmlFor="storeName" required>
              <input
                id="storeName"
                value={values.storeName}
                onChange={(event) => set('storeName', event.target.value)}
                maxLength={80}
                className={inputClass}
              />
            </Field>

            <Field
              label="العبارة التسويقية"
              htmlFor="storeTagline"
              hint="تظهر تحت الاسم في الواجهة الرئيسية والتذييل"
            >
              <input
                id="storeTagline"
                value={values.storeTagline}
                onChange={(event) => set('storeTagline', event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <LogoPicker
                label="الشعار — الوضع الليلي"
                hint="نسخة فاتحة، تُعرض على الخلفية الداكنة"
                value={values.logoUrl}
                preview="dark"
                busy={uploadingKey === 'logoUrl'}
                onPick={(file) => void uploadLogo('logoUrl', file)}
                onClear={() => set('logoUrl', '')}
              />

              <LogoPicker
                label="الشعار — الوضع النهاري"
                hint="نسخة داكنة، تُعرض على الخلفية العاجية"
                value={values.logoUrlLight}
                preview="light"
                busy={uploadingKey === 'logoUrlLight'}
                onPick={(file) => void uploadLogo('logoUrlLight', file)}
                onClear={() => set('logoUrlLight', '')}
              />
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              يُعرض اسم المتجر بخط أنيق إن لم تُرفع شعارًا. وإن رفعت شعار
              الوضع الليلي وحده استُخدم في الوضعين — وقد يكون باهتًا على
              الخلفية الفاتحة.
            </p>
          </div>
        </FormSection>

        {/* ═══════════ التواصل ═══════════ */}
        <FormSection
          title="التواصل"
          description="الحقول الفارغة لا تظهر للعميل إطلاقًا"
        >
          <div className="space-y-4">
            <Field
              label="رقم واتساب"
              htmlFor="whatsappNumber"
              hint="بصيغة دولية بلا رموز: 218912345678"
            >
              <input
                id="whatsappNumber"
                value={values.whatsappNumber}
                onChange={(event) => set('whatsappNumber', event.target.value)}
                dir="ltr"
                inputMode="tel"
                maxLength={25}
                className={`${inputClass} tabular text-start`}
              />
            </Field>

            <Field label="رقم الهاتف" htmlFor="phonePrimary">
              <input
                id="phonePrimary"
                value={values.phonePrimary}
                onChange={(event) => set('phonePrimary', event.target.value)}
                dir="ltr"
                inputMode="tel"
                maxLength={25}
                className={`${inputClass} tabular text-start`}
              />
            </Field>

            <Field label="البريد الإلكتروني" htmlFor="email">
              <input
                id="email"
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
                type="email"
                dir="ltr"
                maxLength={120}
                className={`${inputClass} text-start`}
              />
            </Field>

            <Field label="العنوان" htmlFor="addressText">
              <input
                id="addressText"
                value={values.addressText}
                onChange={(event) => set('addressText', event.target.value)}
                maxLength={200}
                className={inputClass}
              />
            </Field>

            <Field label="أوقات العمل" htmlFor="workingHours">
              <input
                id="workingHours"
                value={values.workingHours}
                onChange={(event) => set('workingHours', event.target.value)}
                placeholder="السبت — الخميس، ١٠ ص إلى ١٠ م"
                maxLength={120}
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        {/* ═══════════ السوشيال ═══════════ */}
        <FormSection
          title="التواصل الاجتماعي"
          description="روابط كاملة تبدأ بـ https"
        >
          <div className="space-y-4">
            <Field label="TikTok" htmlFor="tiktokUrl">
              <input
                id="tiktokUrl"
                value={values.tiktokUrl}
                onChange={(event) => set('tiktokUrl', event.target.value)}
                dir="ltr"
                placeholder="https://tiktok.com/@monebra"
                maxLength={300}
                className={`${inputClass} text-start`}
              />
            </Field>

            <Field label="Instagram" htmlFor="instagramUrl">
              <input
                id="instagramUrl"
                value={values.instagramUrl}
                onChange={(event) => set('instagramUrl', event.target.value)}
                dir="ltr"
                maxLength={300}
                className={`${inputClass} text-start`}
              />
            </Field>

            <Field label="Facebook" htmlFor="facebookUrl">
              <input
                id="facebookUrl"
                value={values.facebookUrl}
                onChange={(event) => set('facebookUrl', event.target.value)}
                dir="ltr"
                maxLength={300}
                className={`${inputClass} text-start`}
              />
            </Field>
          </div>
        </FormSection>

        {/* ═══════════ العملة والبيع ═══════════ */}
        <FormSection title="العملة والبيع">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رمز العملة" htmlFor="currencySymbol" required>
                <input
                  id="currencySymbol"
                  value={values.currencySymbol}
                  onChange={(event) => set('currencySymbol', event.target.value)}
                  maxLength={10}
                  className={inputClass}
                />
              </Field>

              <Field label="رمز ISO" htmlFor="currencyCode" hint="LYD مثلًا">
                <input
                  id="currencyCode"
                  value={values.currencyCode}
                  onChange={(event) => set('currencyCode', event.target.value)}
                  dir="ltr"
                  maxLength={6}
                  className={`${inputClass} text-start`}
                />
              </Field>
            </div>

            <Field
              label="عتبة التوصيل المجاني"
              htmlFor="freeDeliveryThreshold"
              hint="صفر = معطّل. عند تجاوز هذا المبلغ يصبح التوصيل مجانيًا."
            >
              <input
                id="freeDeliveryThreshold"
                value={values.freeDeliveryThreshold}
                onChange={(event) =>
                  set('freeDeliveryThreshold', Number(event.target.value))
                }
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                className={`${inputClass} tabular`}
              />
            </Field>

            <div className="space-y-3 border-t border-[var(--surface-border)] pt-4">
              <Toggle
                label="استقبال الطلبات"
                checked={values.ordersEnabled}
                onChange={(value) => set('ordersEnabled', value)}
                hint="إطفاؤه يوقف الطلبات فورًا — في الواجهة وعلى الخادم معًا"
              />

              <Toggle
                label="تنبيهات المخزون المنخفض"
                checked={values.lowStockAlert}
                onChange={(value) => set('lowStockAlert', value)}
              />

              <Toggle
                label="مراجعة التقييمات قبل نشرها"
                checked={values.reviewsRequireApproval}
                onChange={(value) => set('reviewsRequireApproval', value)}
              />

              <Toggle
                label="وضع الصيانة"
                checked={values.maintenanceMode}
                onChange={(value) => set('maintenanceMode', value)}
                hint="يمنع فهرسة الموقع في محركات البحث"
              />
            </div>
          </div>
        </FormSection>

        {/* ═══════════ النصوص ═══════════ */}
        <FormSection title="نصوص المتجر" >
          <div className="space-y-4">
            <Field
              label="شريط الإعلان"
              htmlFor="announcementBar"
              hint="شريط علوي في كل صفحة — اتركه فارغًا لإخفائه"
            >
              <input
                id="announcementBar"
                value={values.announcementBar}
                onChange={(event) => set('announcementBar', event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </Field>

            <Field
              label="إخلاء المسؤولية القانوني"
              htmlFor="inspiredDisclaimer"
              hint="يظهر في تذييل كل صفحة — مهم قانونيًا لعطور «مستوحاة من»"
            >
              <textarea
                id="inspiredDisclaimer"
                value={values.inspiredDisclaimer}
                onChange={(event) =>
                  set('inspiredDisclaimer', event.target.value)
                }
                rows={4}
                maxLength={600}
                className={textareaClass}
              />
            </Field>

            <Field label="ملاحظة التذييل" htmlFor="footerNote">
              <input
                id="footerNote"
                value={values.footerNote}
                onChange={(event) => set('footerNote', event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        {/* ═══════════ السيو ═══════════ */}
        <FormSection
          title="تحسين محركات البحث"
          description="يُستخدم اسم المتجر وعبارته إن تُركت فارغة"
        >
          <div className="space-y-4">
            <Field label="عنوان الموقع" htmlFor="metaTitle">
              <input
                id="metaTitle"
                value={values.metaTitle}
                onChange={(event) => set('metaTitle', event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </Field>

            <Field label="وصف الموقع" htmlFor="metaDescription">
              <textarea
                id="metaDescription"
                value={values.metaDescription}
                onChange={(event) => set('metaDescription', event.target.value)}
                rows={3}
                maxLength={300}
                className={textareaClass}
              />
            </Field>

            <Field
              label="كلمات مفتاحية"
              htmlFor="metaKeywords"
              hint="مفصولة بفواصل"
            >
              <input
                id="metaKeywords"
                value={values.metaKeywords}
                onChange={(event) => set('metaKeywords', event.target.value)}
                maxLength={300}
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>
      </div>
    </form>
  );
}

type LogoKey = 'logoUrl' | 'logoUrlLight';

/**
 * منتقي شعار مع معاينة على الخلفية التي سيظهر عليها فعلًا.
 *
 * المعاينة على خلفية اللوحة الفاتحة كانت تكذب: شعار أبيض شفاف يبدو فارغًا
 * تمامًا فيظنّه المدير رفعًا فاشلًا. لذلك تُعرض كل نسخة على أرضية وضعها.
 */
function LogoPicker({
  label,
  hint,
  value,
  preview,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  preview: 'dark' | 'light';
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mb-2 text-[11px] text-[var(--text-muted)]">{hint}</p>

      {value ? (
        <div className="flex items-center gap-3">
          <div
            className="relative h-14 w-36 shrink-0 overflow-hidden rounded-lg border border-[var(--surface-border)]"
            style={{
              backgroundColor: preview === 'dark' ? '#08080a' : '#fdfcf9',
            }}
          >
            <Image
              src={value}
              alt={label}
              fill
              sizes="144px"
              className="object-contain p-2"
            />
          </div>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--color-danger)]"
          >
            <X size={13} aria-hidden />
            إزالة
          </button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--surface-border-strong)] px-4 py-3 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Upload size={14} aria-hidden />
          )}
          رفع شعار
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
              // تصفير القيمة يسمح برفع نفس الملف ثانيةً بعد إزالته
              event.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
