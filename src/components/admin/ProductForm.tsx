'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, ArrowRight, ExternalLink } from 'lucide-react';
import { ImageUploader } from '@/components/admin/ImageUploader';
import {
  BundleItemsPicker,
  type BundleItemRow,
  type PickableVariant,
} from '@/components/admin/BundleItemsPicker';
import {
  Field,
  FormSection,
  Toggle,
  ChipToggle,
  inputClass,
  textareaClass,
} from '@/components/admin/form';
import {
  GENDERS,
  GENDER_LABELS,
  SEASONS,
  SEASON_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  TIME_OF_DAY,
  TIME_OF_DAY_LABELS,
  NOTE_TYPES,
  NOTE_TYPE_LABELS,
  INTENSITY_LABELS,
  type NoteType,
} from '@/lib/constants';
import { toMajor } from '@/lib/money';
import type { AdminProduct } from '@/lib/services/admin-products';
import { parseCsvField } from '@/lib/utils';

type VariantRow = {
  id?: string;
  label: string;
  sizeMl: string;
  price: string;
  comparePrice: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
};

/**
 * نموذج المنتج.
 *
 * الأسعار تُعرض وتُدخل بالصيغة المألوفة للمدير (45.5) وتُرسل كذلك؛ الخادم
 * وحده يحوّلها إلى الوحدة الصغرى. هذا يبقي التحويل في مكان واحد ويمنع
 * اختلاف التقريب بين الواجهة والخادم.
 *
 * الحقول النصية تُرسل كما هي، والتحقق النهائي على الخادم — ما هنا تحسين
 * للتجربة لا حماية.
 */
export function ProductForm({
  product,
  categories,
  brands,
  currencySymbol,
  currencyDecimals,
  bundleVariants,
  defaultType = 'simple',
}: {
  product: AdminProduct | null;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  currencySymbol: string;
  currencyDecimals: number;
  /** كل الأحجام المتاحة للاختيار داخل باقة */
  bundleVariants: PickableVariant[];
  /** نوع المنتج عند الإنشاء — يأتي من الصفحة التي فُتح منها النموذج */
  defaultType?: 'simple' | 'bundle';
}) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [type, setType] = useState<'simple' | 'bundle'>(
    (product?.type as 'simple' | 'bundle' | undefined) ?? defaultType,
  );
  const isBundle = type === 'bundle';

  const [bundleItems, setBundleItems] = useState<BundleItemRow[]>(
    product?.bundleItems.map((item) => ({
      variantId: item.itemVariant.id,
      quantity: item.quantity,
    })) ?? [],
  );

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [shortDescription, setShortDescription] = useState(
    product?.shortDescription ?? '',
  );
  const [description, setDescription] = useState(product?.description ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [inspirationBrandId, setInspirationBrandId] = useState(
    product?.inspirationBrandId ?? '',
  );
  const [inspirationName, setInspirationName] = useState(
    product?.inspirationName ?? '',
  );

  const [gender, setGender] = useState(product?.gender ?? 'unisex');
  const [fragranceFamily, setFragranceFamily] = useState(
    product?.fragranceFamily ?? '',
  );
  const [longevity, setLongevity] = useState(product?.longevity ?? 3);
  const [sillage, setSillage] = useState(product?.sillage ?? 3);
  const [seasons, setSeasons] = useState<string[]>(
    parseCsvField(product?.season),
  );
  const [occasions, setOccasions] = useState<string[]>(
    parseCsvField(product?.occasion),
  );
  const [timeOfDay, setTimeOfDay] = useState(product?.timeOfDay ?? '');

  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [isBestSeller, setIsBestSeller] = useState(product?.isBestSeller ?? false);
  const [isLimited, setIsLimited] = useState(product?.isLimited ?? false);

  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? '');
  const [ogImage, setOgImage] = useState(product?.ogImage ?? '');
  const [metaDescription, setMetaDescription] = useState(
    product?.metaDescription ?? '',
  );
  const [keywords, setKeywords] = useState(product?.keywords ?? '');

  const [images, setImages] = useState<string[]>(
    product?.images.map((image) => image.url) ?? [],
  );

  const [notes, setNotes] = useState<Record<NoteType, string>>({
    top: joinNotes(product, 'top'),
    middle: joinNotes(product, 'middle'),
    base: joinNotes(product, 'base'),
  });

  const [variants, setVariants] = useState<VariantRow[]>(
    product && product.variants.length > 0
      ? product.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          sizeMl: variant.sizeMl?.toString() ?? '',
          price: String(toMajor(variant.price)),
          comparePrice:
            variant.comparePrice != null
              ? String(toMajor(variant.comparePrice))
              : '',
          stock: String(variant.stock),
          lowStockThreshold: String(variant.lowStockThreshold),
          isActive: variant.isActive,
        }))
      : [emptyVariant()],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('أدخل اسم المنتج');
      return;
    }

    const parsedVariants = variants.map((row) => ({
      id: row.id,
      label: row.label.trim(),
      sizeMl: row.sizeMl ? Number(row.sizeMl) : null,
      price: Number(row.price),
      comparePrice: row.comparePrice ? Number(row.comparePrice) : null,
      stock: Number(row.stock || 0),
      lowStockThreshold: Number(row.lowStockThreshold || 5),
      isActive: row.isActive,
    }));

    const badVariant = parsedVariants.find(
      (variant) =>
        !variant.label ||
        !Number.isFinite(variant.price) ||
        variant.price <= 0 ||
        !Number.isInteger(variant.stock) ||
        variant.stock < 0,
    );

    if (badVariant) {
      setError('راجع الأحجام: كل حجم يحتاج اسمًا وسعرًا أكبر من صفر ومخزونًا صحيحًا');
      return;
    }

    if (isBundle && bundleItems.length === 0) {
      setError('أضف صنفًا واحدًا على الأقل إلى الباقة');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product?.id,
          type,
          bundleItems: isBundle ? bundleItems : undefined,
          name: name.trim(),
          slug: slug.trim() || undefined,
          shortDescription: shortDescription.trim() || null,
          description: description.trim() || null,
          categoryId: categoryId || null,
          inspirationBrandId: inspirationBrandId || null,
          inspirationName: inspirationName.trim() || null,
          gender,
          fragranceFamily: fragranceFamily.trim() || null,
          longevity,
          sillage,
          seasons,
          occasions,
          timeOfDay: timeOfDay || null,
          isActive,
          isFeatured,
          isNew,
          isBestSeller,
          isLimited,
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          // صورة المشاركة اختيارية؛ الفارغ يعني «استخدم الصورة الأولى»
          ogImage: images.includes(ogImage) ? ogImage : null,
          keywords: keywords.trim() || null,
          images,
          notes: NOTE_TYPES.flatMap((type) =>
            splitNotes(notes[type]).map((noteName) => ({ type, name: noteName })),
          ),
          variants: parsedVariants,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حفظ المنتج');
        setSaving(false);
        return;
      }

      router.push('/admin/products');
      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* ═══════════ الترويسة ═══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
        >
          <ArrowRight size={13} aria-hidden />
          كل المنتجات
        </Link>

        <div className="flex items-center gap-2">
          {isEdit && product ? (
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--surface-border-strong)] px-4 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ExternalLink size={14} aria-hidden />
              معاينة
            </Link>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : null}
            {isEdit ? 'حفظ التعديلات' : 'إنشاء المنتج'}
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

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          {/* ═══════════ الأساسيات ═══════════ */}
          <FormSection title="المعلومات الأساسية">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم المنتج" htmlFor="name" required className="sm:col-span-2">
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  className={inputClass}
                />
              </Field>

              <Field
                label="الرابط (Slug)"
                htmlFor="slug"
                hint="يُولَّد من الاسم إن تُرك فارغًا — يُستخدم في روابط TikTok"
                className="sm:col-span-2"
              >
                <input
                  id="slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  dir="ltr"
                  placeholder="monebra-noir"
                  maxLength={160}
                  className={`${inputClass} text-start`}
                />
              </Field>

              <Field
                label="وصف مختصر"
                htmlFor="shortDescription"
                hint="سطر واحد يظهر في بطاقة المنتج"
                className="sm:col-span-2"
              >
                <textarea
                  id="shortDescription"
                  value={shortDescription}
                  onChange={(event) => setShortDescription(event.target.value)}
                  rows={2}
                  maxLength={300}
                  className={textareaClass}
                />
              </Field>

              <Field label="الوصف الكامل" htmlFor="description" className="sm:col-span-2">
                <textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  maxLength={5000}
                  className={textareaClass}
                />
              </Field>

              <Field label="التصنيف" htmlFor="categoryId">
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">بلا تصنيف</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="الجنس" htmlFor="gender" required>
                <select
                  id="gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className={inputClass}
                >
                  {GENDERS.map((value) => (
                    <option key={value} value={value}>
                      {GENDER_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          {/* ═══════════ مستوحى من ═══════════ */}
          <FormSection
            title="العطر المستوحى منه"
            description="يُعرض دائمًا مسبوقًا بعبارة «مستوحى من» — ولا يُقدَّم المنتج على أنه الأصلي"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="العلامة العالمية" htmlFor="inspirationBrandId">
                <select
                  id="inspirationBrandId"
                  value={inspirationBrandId}
                  onChange={(event) => setInspirationBrandId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">بلا علامة</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="اسم العطر الأصلي"
                htmlFor="inspirationName"
                hint="مثال: Sauvage — يساعد العميل على إيجاد المنتج بالبحث"
              >
                <input
                  id="inspirationName"
                  value={inspirationName}
                  onChange={(event) => setInspirationName(event.target.value)}
                  maxLength={160}
                  className={inputClass}
                />
              </Field>
            </div>
          </FormSection>

          {/* ═══════════ أصناف الباقة ═══════════ */}
          {isBundle ? (
            <FormSection
              title="أصناف الباقة"
              description="العطور التي تتكوّن منها هذه الباقة — تظهر للعميل في صفحتها"
            >
              <BundleItemsPicker
                items={bundleItems}
                onChange={setBundleItems}
                available={bundleVariants}
                currencySymbol={currencySymbol}
                currencyDecimals={currencyDecimals}
              />
            </FormSection>
          ) : null}

          {/* ═══════════ الأحجام ═══════════ */}
          <FormSection
            title="الأحجام والأسعار"
            description={
              isBundle
                ? `سعر الباقة ومخزونها. المخزون مستقل عن مخزون أصنافها — الباقات تُجهَّز مسبقًا كوحدات جاهزة.`
                : `الأسعار بالـ${currencySymbol}. كل حجم له سعره ومخزونه المستقل.`
            }
          >
            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={variant.id ?? `new-${index}`}
                  className="rounded-lg border border-[var(--surface-border)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      الحجم {index + 1}
                      {variant.id ? '' : ' (جديد)'}
                    </span>

                    {variants.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVariants((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                        aria-label={`حذف الحجم ${index + 1}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--color-danger)]"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="الاسم" htmlFor={`label-${index}`} required>
                      <input
                        id={`label-${index}`}
                        value={variant.label}
                        onChange={(event) =>
                          updateVariant(index, { label: event.target.value })
                        }
                        placeholder="50 مل"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="الحجم (مل)" htmlFor={`sizeMl-${index}`}>
                      <input
                        id={`sizeMl-${index}`}
                        value={variant.sizeMl}
                        onChange={(event) =>
                          updateVariant(index, { sizeMl: event.target.value })
                        }
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className={`${inputClass} tabular`}
                      />
                    </Field>

                    <Field label="المخزون" htmlFor={`stock-${index}`} required>
                      <input
                        id={`stock-${index}`}
                        value={variant.stock}
                        onChange={(event) =>
                          updateVariant(index, { stock: event.target.value })
                        }
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className={`${inputClass} tabular`}
                      />
                    </Field>

                    <Field label="السعر" htmlFor={`price-${index}`} required>
                      <input
                        id={`price-${index}`}
                        value={variant.price}
                        onChange={(event) =>
                          updateVariant(index, { price: event.target.value })
                        }
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        className={`${inputClass} tabular`}
                      />
                    </Field>

                    <Field
                      label="السعر قبل الخصم"
                      htmlFor={`comparePrice-${index}`}
                      hint="اتركه فارغًا إن لا يوجد خصم"
                    >
                      <input
                        id={`comparePrice-${index}`}
                        value={variant.comparePrice}
                        onChange={(event) =>
                          updateVariant(index, {
                            comparePrice: event.target.value,
                          })
                        }
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        className={`${inputClass} tabular`}
                      />
                    </Field>

                    <Field
                      label="حد التنبيه"
                      htmlFor={`threshold-${index}`}
                      hint="ننبّهك عند بلوغ هذا العدد"
                    >
                      <input
                        id={`threshold-${index}`}
                        value={variant.lowStockThreshold}
                        onChange={(event) =>
                          updateVariant(index, {
                            lowStockThreshold: event.target.value,
                          })
                        }
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className={`${inputClass} tabular`}
                      />
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Toggle
                      label="متاح للبيع"
                      checked={variant.isActive}
                      onChange={(value) =>
                        updateVariant(index, { isActive: value })
                      }
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setVariants((rows) => [...rows, emptyVariant()])}
                className="tap-target flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--surface-border-strong)] text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Plus size={15} aria-hidden />
                إضافة حجم
              </button>
            </div>
          </FormSection>

          {/* ═══════════ النوتات ═══════════ */}
          <FormSection
            title="النوتات العطرية"
            description="افصل بين النوتات بفاصلة — تظهر في صفحة المنتج وتُستخدم في البحث والفلاتر"
          >
            <div className="space-y-4">
              {NOTE_TYPES.map((type) => (
                <Field
                  key={type}
                  label={NOTE_TYPE_LABELS[type]}
                  htmlFor={`notes-${type}`}
                >
                  <input
                    id={`notes-${type}`}
                    value={notes[type]}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [type]: event.target.value,
                      }))
                    }
                    placeholder="البرغموت، الليمون، الفلفل"
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          </FormSection>

          {/* ═══════════ الخصائص ═══════════ */}
          <FormSection title="خصائص العطر">
            <div className="space-y-5">
              <Field label="العائلة العطرية" htmlFor="fragranceFamily">
                <input
                  id="fragranceFamily"
                  value={fragranceFamily}
                  onChange={(event) => setFragranceFamily(event.target.value)}
                  placeholder="شرقي خشبي"
                  maxLength={80}
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`الثبات — ${INTENSITY_LABELS[longevity]}`} htmlFor="longevity">
                  <input
                    id="longevity"
                    type="range"
                    min={1}
                    max={5}
                    value={longevity}
                    onChange={(event) => setLongevity(Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>

                <Field label={`الفوحان — ${INTENSITY_LABELS[sillage]}`} htmlFor="sillage">
                  <input
                    id="sillage"
                    type="range"
                    min={1}
                    max={5}
                    value={sillage}
                    onChange={(event) => setSillage(Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                  الموسم المناسب
                </p>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((season) => (
                    <ChipToggle
                      key={season}
                      label={SEASON_LABELS[season]}
                      active={seasons.includes(season)}
                      onClick={() => setSeasons((list) => toggleIn(list, season))}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                  المناسبة
                </p>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((occasion) => (
                    <ChipToggle
                      key={occasion}
                      label={OCCASION_LABELS[occasion]}
                      active={occasions.includes(occasion)}
                      onClick={() =>
                        setOccasions((list) => toggleIn(list, occasion))
                      }
                    />
                  ))}
                </div>
              </div>

              <Field label="أفضل وقت للاستخدام" htmlFor="timeOfDay">
                <select
                  id="timeOfDay"
                  value={timeOfDay}
                  onChange={(event) => setTimeOfDay(event.target.value)}
                  className={inputClass}
                >
                  <option value="">غير محدد</option>
                  {TIME_OF_DAY.map((value) => (
                    <option key={value} value={value}>
                      {TIME_OF_DAY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          {/* ═══════════ السيو ═══════════ */}
          <FormSection
            title="تحسين محركات البحث"
            description="يُولَّد من اسم المنتج ووصفه إن تُرك فارغًا"
          >
            <div className="space-y-4">
              <Field label="عنوان الصفحة" htmlFor="metaTitle">
                <input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(event) => setMetaTitle(event.target.value)}
                  maxLength={160}
                  className={inputClass}
                />
              </Field>

              <Field label="وصف الصفحة" htmlFor="metaDescription">
                <textarea
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                  rows={2}
                  maxLength={300}
                  className={textareaClass}
                />
              </Field>

              <Field
                label="صورة المشاركة"
                htmlFor="ogImage"
                hint="تظهر عند مشاركة رابط المنتج على واتساب وفيسبوك. الافتراضي أول صورة."
              >
                <select
                  id="ogImage"
                  value={images.includes(ogImage) ? ogImage : ''}
                  onChange={(event) => setOgImage(event.target.value)}
                  disabled={images.length === 0}
                  className={inputClass}
                >
                  <option value="">
                    {images.length === 0
                      ? 'ارفع صورة أولًا'
                      : 'الصورة الأولى (افتراضي)'}
                  </option>
                  {images.map((url, index) => (
                    <option key={url} value={url}>
                      صورة {index + 1}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="كلمات مفتاحية"
                htmlFor="keywords"
                hint="مفصولة بفواصل — تُستخدم في البحث داخل المتجر أيضًا"
              >
                <input
                  id="keywords"
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  maxLength={300}
                  className={inputClass}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        {/* ═══════════ العمود الجانبي ═══════════ */}
        <div className="space-y-5">
          <FormSection title="الصور">
            <ImageUploader images={images} onChange={setImages} />
          </FormSection>

          <FormSection title="نوع المنتج">
            <div className="flex gap-2">
              <TypeOption
                label="عطر مفرد"
                active={!isBundle}
                onClick={() => setType('simple')}
                disabled={isEdit}
              />
              <TypeOption
                label="باقة"
                active={isBundle}
                onClick={() => setType('bundle')}
                disabled={isEdit}
              />
            </div>

            {isEdit ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                لا يمكن تحويل منتج قائم بين النوعين — أنشئ منتجًا جديدًا.
              </p>
            ) : null}
          </FormSection>

          <FormSection title="النشر والشارات">
            <div className="space-y-3">
              <Toggle
                label="منشور في المتجر"
                checked={isActive}
                onChange={setIsActive}
                hint="إخفاؤه يزيله من المتجر دون حذف بياناته"
              />

              <div className="h-px bg-[var(--surface-border)]" />

              <Toggle
                label="ضمن المختارات"
                checked={isFeatured}
                onChange={setIsFeatured}
                hint="يظهر في الواجهة الرئيسية"
              />
              <Toggle label="جديد" checked={isNew} onChange={setIsNew} />
              <Toggle
                label="الأكثر مبيعًا"
                checked={isBestSeller}
                onChange={setIsBestSeller}
              />
              <Toggle
                label="كمية محدودة"
                checked={isLimited}
                onChange={setIsLimited}
              />
            </div>
          </FormSection>
        </div>
      </div>
    </form>
  );
}

function TypeOption({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`tap-target flex-1 rounded-lg border px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)]'
      }`}
    >
      {label}
    </button>
  );
}

function emptyVariant(): VariantRow {
  return {
    label: '',
    sizeMl: '',
    price: '',
    comparePrice: '',
    stock: '0',
    lowStockThreshold: '5',
    isActive: true,
  };
}

function joinNotes(product: AdminProduct | null, type: NoteType): string {
  if (!product) return '';
  return product.notes
    .filter((note) => note.type === type)
    .map((note) => note.name)
    .join('، ');
}

/** يقبل الفاصلة العربية والإنجليزية معًا */
function splitNotes(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}
