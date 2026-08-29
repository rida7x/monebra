'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ZoomIn, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * معرض صور المنتج.
 *
 * • الصورة الأولى `priority` — أكبر عنصر مرئي في الصفحة (LCP)
 * • النقر يفتح تكبيرًا بملء الشاشة؛ على الهاتف تُقرّب بإصبعين طبيعيًا
 * • بلا صور: نعرض شكلًا أنيقًا بدل مربع مكسور، ونخفي أدوات المعرض
 */
export function ProductGallery({
  images,
  productName,
  badges,
}: {
  images: { url: string; alt: string | null }[];
  productName: string;
  badges?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const current = images[active];
  const hasImages = images.length > 0;

  return (
    <div className="space-y-3">
      <div className="surface-card relative aspect-square overflow-hidden">
        {hasImages && current ? (
          <>
            <Image
              src={current.url}
              alt={current.alt ?? productName}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
              className="object-cover"
            />

            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="تكبير الصورة"
              className="glass tap-target absolute bottom-3 end-3 flex items-center justify-center rounded-full transition-colors hover:border-[var(--accent)]"
            >
              <ZoomIn size={17} aria-hidden />
            </button>
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,var(--surface-sunken),var(--surface-raised))]"
            aria-hidden
          >
            <span className="font-display text-7xl text-[var(--text-muted)]/20">
              M
            </span>
          </div>
        )}

        {badges ? (
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-4">
            {badges}
          </div>
        ) : null}
      </div>

      {/* ── المصغّرات ── */}
      {images.length > 1 ? (
        <div
          className="scrollbar-none flex gap-2 overflow-x-auto"
          role="tablist"
          aria-label="صور المنتج"
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`الصورة ${index + 1}`}
              onClick={() => setActive(index)}
              className={cn(
                'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300',
                index === active
                  ? 'border-[var(--accent)]'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* ── التكبير ── */}
      <AnimatePresence>
        {zoomed && current ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/92 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="عرض مكبّر للصورة"
            onClick={() => setZoomed(false)}
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="إغلاق"
              className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={22} aria-hidden />
            </button>

            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full max-h-[85vh] w-full max-w-4xl"
            >
              <Image
                src={current.url}
                alt={current.alt ?? productName}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
