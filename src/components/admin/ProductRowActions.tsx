'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react';

/**
 * إجراءات صف المنتج: تعديل، معاينة، نشر/إخفاء، حذف.
 *
 * الحذف يطلب تأكيدًا، وقد يرفضه الخادم إن كان المنتج قد بيع من قبل —
 * وقتها نعرض سبب الرفض ونقترح الإخفاء. لا نخفي الزر مسبقًا لأن معرفة
 * «هل بيع؟» تتطلب استعلامًا إضافيًا لكل صف.
 */
export function ProductRowActions({
  productId,
  productName,
  slug,
  isActive,
  canManage,
}: {
  productId: string;
  productName: string;
  slug: string;
  isActive: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy('toggle');
    setError(null);

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر تغيير الحالة');
        return;
      }

      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setError(null);

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حذف المنتج');
        setConfirming(false);
        return;
      }

      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/product/${slug}`}
          target="_blank"
          aria-label={`معاينة ${productName}`}
          title="معاينة في المتجر"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
        >
          <ExternalLink size={15} aria-hidden />
        </Link>

        {canManage ? (
          <>
            <Link
              href={`/admin/products/${productId}`}
              aria-label={`تعديل ${productName}`}
              title="تعديل"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
            >
              <Pencil size={15} aria-hidden />
            </Link>

            <button
              type="button"
              onClick={toggleActive}
              disabled={busy !== null}
              aria-label={isActive ? `إخفاء ${productName}` : `نشر ${productName}`}
              title={isActive ? 'إخفاء من المتجر' : 'نشر في المتجر'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)] disabled:opacity-40"
            >
              {busy === 'toggle' ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : isActive ? (
                <EyeOff size={15} aria-hidden />
              ) : (
                <Eye size={15} aria-hidden />
              )}
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy !== null}
              aria-label={`حذف ${productName}`}
              title="حذف"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-40"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 px-3 py-2">
          <span className="text-xs text-[var(--color-danger)]">حذف نهائيًا؟</span>

          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="rounded px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:underline disabled:opacity-50"
          >
            {busy === 'delete' ? 'جارٍ…' : 'نعم'}
          </button>

          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:underline"
          >
            تراجع
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="max-w-[16rem] text-end text-xs leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
