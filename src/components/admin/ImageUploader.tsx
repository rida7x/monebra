'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Upload, X, Loader2, Star, ArrowRight, ArrowLeft } from 'lucide-react';

/**
 * رفع صور المنتج وترتيبها.
 *
 * الصورة الأولى هي الصورة الرئيسية — تظهر في بطاقة المنتج وفي نتائج
 * البحث وفي الطلبات. لذلك نتيح تحريك الصور بدل إجبار المدير على حذف
 * الكل وإعادة الرفع بالترتيب الصحيح.
 *
 * الرفع يتم فورًا لا عند حفظ المنتج: هذا يجعل المعاينة حقيقية ويجنّب
 * إرسال ملفات ثقيلة داخل طلب حفظ المنتج نفسه.
 */
export function ImageUploader({
  images,
  onChange,
  max = 8,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);

    const room = max - images.length;
    if (room <= 0) {
      setError(`الحد الأقصى ${max} صور`);
      return;
    }

    const selected = Array.from(files).slice(0, room);
    setUploading(selected.length);

    const uploaded: string[] = [];

    for (const file of selected) {
      const form = new FormData();
      form.append('file', file);

      try {
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: form,
        });

        const data = (await response.json()) as { url?: string; error?: string };

        if (!response.ok || !data.url) {
          setError(data.error ?? 'تعذّر رفع الصورة');
        } else {
          uploaded.push(data.url);
        }
      } catch {
        setError('تعذّر الاتصال بالخادم أثناء الرفع');
      }

      setUploading((count) => count - 1);
    }

    if (uploaded.length > 0) onChange([...images, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((url, index) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-sunken)]"
          >
            <Image
              src={url}
              alt={index === 0 ? 'الصورة الرئيسية' : `صورة ${index + 1}`}
              fill
              sizes="160px"
              className="object-cover"
            />

            {index === 0 ? (
              <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--accent-contrast)]">
                <Star size={9} aria-hidden />
                رئيسية
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => onChange(images.filter((item) => item !== url))}
              aria-label={`حذف الصورة ${index + 1}`}
              className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-[var(--color-danger)]"
            >
              <X size={13} aria-hidden />
            </button>

            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="تحريك لليمين"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ArrowRight size={13} aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === images.length - 1}
                aria-label="تحريك لليسار"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ArrowLeft size={13} aria-hidden />
              </button>
            </div>
          </div>
        ))}

        {uploading > 0
          ? Array.from({ length: uploading }, (_, index) => (
              <div
                key={`uploading-${index}`}
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface-sunken)]"
              >
                <Loader2
                  size={20}
                  className="animate-spin text-[var(--text-muted)]"
                  aria-hidden
                />
              </div>
            ))
          : null}

        {images.length + uploading < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--surface-border-strong)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Upload size={19} aria-hidden />
            <span className="text-xs">إضافة صورة</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
        className="sr-only"
      />

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        الصورة الأولى هي الرئيسية. تُحوَّل الصور تلقائيًا إلى WebP وتُصغَّر
        لتسريع الموقع. الحد الأقصى {max} صور.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
