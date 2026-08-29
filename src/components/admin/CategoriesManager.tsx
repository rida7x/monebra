'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Trash2, Loader2, Pencil, X, Tags, Eye, EyeOff } from 'lucide-react';
import { Field, Toggle, inputClass, textareaClass } from '@/components/admin/form';
import { cn } from '@/lib/utils';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
};

/**
 * إدارة التصنيفات.
 *
 * الترتيب (`sortOrder`) يحدد ظهورها في قائمة المتجر وفي الواجهة الرئيسية.
 * الرابط (`slug`) يُولَّد من الاسم ويُستخدم في `/category/[slug]` — تغييره
 * يكسر أي رابط منشور، ولهذا نعرضه بوضوح بدل إخفائه.
 */
export function CategoriesManager({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {categories.length}
          </span>{' '}
          تصنيف
        </p>

        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus size={16} aria-hidden />
          تصنيف جديد
        </button>
      </div>

      {creating ? (
        <CategoryEditor
          category={null}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <div className="space-y-3">
        {categories.map((category) =>
          editing === category.id ? (
            <CategoryEditor
              key={category.id}
              category={category}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              key={category.id}
              className="surface-card flex flex-wrap items-center gap-3 p-4"
            >
              <Tags
                size={17}
                className={cn(
                  'shrink-0',
                  category.isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)]',
                )}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {category.name}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[0.65rem] font-normal',
                      category.isActive
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--text-muted)]',
                    )}
                  >
                    {category.isActive ? (
                      <Eye size={11} aria-hidden />
                    ) : (
                      <EyeOff size={11} aria-hidden />
                    )}
                    {category.isActive ? 'ظاهر' : 'مخفي'}
                  </span>
                </p>

                <p dir="ltr" className="mt-0.5 text-start text-xs text-[var(--text-muted)]">
                  /category/{category.slug}
                </p>
              </div>

              <span className="tabular shrink-0 rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                {category.productCount} منتج
              </span>

              <button
                type="button"
                onClick={() => {
                  setEditing(category.id);
                  setCreating(false);
                }}
                aria-label={`تعديل ${category.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
              >
                <Pencil size={15} aria-hidden />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CategoryEditor({
  category,
  onDone,
  onCancel,
}: {
  category: CategoryRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(
    String(category?.sortOrder ?? 0),
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    if (!name.trim()) {
      setError('أدخل اسم التصنيف');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: category?.id,
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
          sortOrder: Number(sortOrder) || 0,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حفظ التصنيف');
        setSaving(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setSaving(false);
    }
  }

  async function remove() {
    if (!category) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories?id=${category.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر حذف التصنيف');
        setDeleting(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setDeleting(false);
    }
  }

  const key = category?.id ?? 'new';

  return (
    <div className="surface-card border-[var(--accent)]/50 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {category ? `تعديل ${category.name}` : 'تصنيف جديد'}
        </h3>

        <button
          type="button"
          onClick={onCancel}
          aria-label="إغلاق"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="اسم التصنيف" htmlFor={`cat-name-${key}`} required>
          <input
            id={`cat-name-${key}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field
          label="الرابط"
          htmlFor={`cat-slug-${key}`}
          hint={category ? 'تغييره يكسر الروابط المنشورة' : 'يُولَّد من الاسم'}
        >
          <input
            id={`cat-slug-${key}`}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            dir="ltr"
            maxLength={80}
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field
          label="الترتيب"
          htmlFor={`cat-order-${key}`}
          hint="الأصغر يظهر أولًا"
        >
          <input
            id={`cat-order-${key}`}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            type="number"
            min={0}
            inputMode="numeric"
            className={`${inputClass} tabular`}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="الوصف" htmlFor={`cat-desc-${key}`}>
          <textarea
            id={`cat-desc-${key}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
            className={textareaClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Toggle
          label="ظاهر في المتجر"
          checked={isActive}
          onChange={setIsActive}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || deleting}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : null}
          حفظ
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
        >
          إلغاء
        </button>

        {category && category.productCount === 0 ? (
          <button
            type="button"
            onClick={remove}
            disabled={saving || deleting}
            className="tap-target ms-auto inline-flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/50 px-5 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Trash2 size={14} aria-hidden />
            )}
            حذف
          </button>
        ) : null}
      </div>
    </div>
  );
}
