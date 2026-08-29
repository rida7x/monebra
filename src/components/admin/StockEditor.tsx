'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Loader2, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * تعديل مخزون حجم واحد مباشرة من الجدول.
 *
 * التعديل السريع (+/−) والتعيين المباشر كلاهما يمر بنفس نقطة النهاية،
 * وكلاهما يُسجَّل كحركة تدقيق. لا يوجد طريق يغيّر المخزون بلا سجل.
 */
export function StockEditor({
  variantId,
  stock,
  threshold,
  canManage,
  label,
}: {
  variantId: string;
  stock: number;
  threshold: number;
  canManage: boolean;
  /** «مونيبرا نوار — 50 مل» — يُنطق مع الحقل ليعرف قارئ الشاشة أي صف */
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(stock));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = Number(value) !== stock;

  const level =
    stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'ok';

  if (!canManage) {
    return (
      <span
        className={cn(
          'tabular rounded-full px-3 py-1 text-xs font-semibold',
          level === 'out' && 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
          level === 'low' && 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
          level === 'ok' && 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
        )}
      >
        {stock}
      </span>
    );
  }

  async function save(next: number) {
    if (next < 0) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, stock: next }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر التحديث');
        setValue(String(stock));
        return;
      }

      setValue(String(next));
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setValue(String(stock));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => save(stock - 1)}
          disabled={saving || stock <= 0}
          aria-label={`إنقاص مخزون ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] disabled:opacity-30"
        >
          <Minus size={13} aria-hidden />
        </button>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            const next = Number(value);
            if (Number.isInteger(next) && next >= 0 && next !== stock) {
              void save(next);
            } else if (!Number.isInteger(next) || next < 0) {
              setValue(String(stock));
            }
          }}
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`مخزون ${label}`}
          className={cn(
            'tabular h-9 w-16 rounded-lg border bg-[var(--surface-base)] px-2 text-center text-sm outline-none transition-colors',
            dirty
              ? 'border-[var(--accent)]'
              : level === 'out'
                ? 'border-[var(--color-danger)]/50 text-[var(--color-danger)]'
                : level === 'low'
                  ? 'border-[var(--color-warning)]/50 text-[var(--color-warning)]'
                  : 'border-[var(--surface-border)]',
          )}
        />

        <button
          type="button"
          onClick={() => save(stock + 1)}
          disabled={saving}
          aria-label={`زيادة مخزون ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] disabled:opacity-30"
        >
          <Plus size={13} aria-hidden />
        </button>

        {saving ? (
          <Loader2
            size={14}
            className="animate-spin text-[var(--text-muted)]"
            aria-hidden
          />
        ) : saved ? (
          <Check size={14} className="text-[var(--color-success)]" aria-hidden />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
