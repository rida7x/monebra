'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Loader2, X, Trash2, KeyRound, UserCheck, UserX } from 'lucide-react';
import { Field, inputClass } from '@/components/admin/form';
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  ROLE_PERMISSIONS,
  type AdminRole,
} from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/**
 * إدارة مستخدمي اللوحة وأدوارهم.
 *
 * نعرض تحت كل دور عدد صلاحياته وأهمها، لأن اسم الدور وحده لا يوضّح ماذا
 * يستطيع صاحبه فعلًا. القيود (لا تعطّل نفسك، لا تحذف آخر مدير عام) مفروضة
 * على الخادم؛ ما هنا إخفاء الأزرار لتفادي محاولة مرفوضة.
 */
export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر تنفيذ العملية');
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError('تعذّر الاتصال بالخادم');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`حذف المستخدم «${name}» نهائيًا؟`)) return;

    setBusy(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر الحذف');
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="tabular font-semibold text-[var(--text-primary)]">
            {users.length}
          </span>{' '}
          مستخدم
        </p>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus size={16} aria-hidden />
          مستخدم جديد
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      {creating ? (
        <CreateUser
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <div className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const role = user.role as AdminRole;
          const permissions = ROLE_PERMISSIONS[role] ?? [];

          return (
            <div key={user.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {user.name}
                    {isSelf ? (
                      <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--accent)]">
                        أنت
                      </span>
                    ) : null}
                    {!user.isActive ? (
                      <span className="rounded-full bg-[var(--color-danger)]/12 px-2 py-0.5 text-[0.65rem] font-normal text-[var(--color-danger)]">
                        معطّل
                      </span>
                    ) : null}
                  </p>

                  <p dir="ltr" className="mt-0.5 text-start text-xs text-[var(--text-muted)]">
                    {user.email}
                  </p>

                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    {ADMIN_ROLE_LABELS[role] ?? user.role} ·{' '}
                    <span className="tabular">{permissions.length}</span> صلاحية
                  </p>

                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {user.lastLoginAt
                      ? `آخر دخول: ${formatDate(user.lastLoginAt, 'datetime')}`
                      : 'لم يسجّل الدخول بعد'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isSelf ? (
                    <select
                      value={user.role}
                      onChange={(event) =>
                        patch(user.id, { role: event.target.value })
                      }
                      disabled={busy === user.id}
                      aria-label={`دور ${user.name}`}
                      className="h-10 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-50"
                    >
                      {ADMIN_ROLES.map((value) => (
                        <option key={value} value={value}>
                          {ADMIN_ROLE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      setResetting(resetting === user.id ? null : user.id)
                    }
                    aria-label={`تغيير كلمة مرور ${user.name}`}
                    title="تغيير كلمة المرور"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
                  >
                    <KeyRound size={15} aria-hidden />
                  </button>

                  {!isSelf ? (
                    <>
                      <button
                        type="button"
                        onClick={() => patch(user.id, { isActive: !user.isActive })}
                        disabled={busy === user.id}
                        aria-label={
                          user.isActive ? `تعطيل ${user.name}` : `تفعيل ${user.name}`
                        }
                        title={user.isActive ? 'تعطيل' : 'تفعيل'}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)] disabled:opacity-40"
                      >
                        {busy === user.id ? (
                          <Loader2 size={15} className="animate-spin" aria-hidden />
                        ) : user.isActive ? (
                          <UserX size={15} aria-hidden />
                        ) : (
                          <UserCheck size={15} aria-hidden />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(user.id, user.name)}
                        disabled={busy === user.id}
                        aria-label={`حذف ${user.name}`}
                        title="حذف"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-40"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {resetting === user.id ? (
                <PasswordReset
                  onSubmit={async (password) => {
                    const ok = await patch(user.id, { password });
                    if (ok) setResetting(null);
                    return ok;
                  }}
                  onCancel={() => setResetting(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ═══════════ شرح الأدوار ═══════════ */}
      <section className="surface-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">ماذا يستطيع كل دور؟</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {ADMIN_ROLES.map((role) => (
            <div
              key={role}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <p className="text-sm font-semibold">{ADMIN_ROLE_LABELS[role]}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {ROLE_DESCRIPTIONS[role]}
              </p>
              <p className="tabular mt-2 text-xs text-[var(--text-muted)]">
                {ROLE_PERMISSIONS[role].length} صلاحية
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin:
    'صلاحية كاملة على كل شيء، بما فيه الإعدادات وإدارة المستخدمين وسجل الأخطاء.',
  manager:
    'إدارة المنتجات والطلبات والمخزون والعملاء والمدن والكوبونات والمحتوى — بلا إعدادات ولا مستخدمين.',
  orders_manager:
    'الطلبات فقط: عرضها وتغيير حالاتها ومشاهدة بيانات العملاء والمنتجات دون تعديلها.',
  inventory_manager:
    'المنتجات والمخزون: إضافة وتعديل المنتجات وضبط الكميات. يرى الطلبات دون تغييرها.',
};

function CreateUser({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('orders_manager');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر إنشاء المستخدم');
        setSaving(false);
        return;
      }

      onDone();
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="surface-card border-[var(--accent)]/50 p-4 sm:p-5"
      noValidate
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">مستخدم جديد</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="إغلاق"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم" htmlFor="newUserName" required>
          <input
            id="newUserName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="البريد الإلكتروني" htmlFor="newUserEmail" required>
          <input
            id="newUserEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            dir="ltr"
            maxLength={200}
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field
          label="كلمة المرور"
          htmlFor="newUserPassword"
          required
          hint="١٠ أحرف على الأقل، مع حرف لاتيني ورقم"
        >
          <input
            id="newUserPassword"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            dir="ltr"
            maxLength={200}
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field label="الدور" htmlFor="newUserRole" required>
          <select
            id="newUserRole"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={inputClass}
          >
            {ADMIN_ROLES.map((value) => (
              <option key={value} value={value}>
                {ADMIN_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          إنشاء
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--surface-border)] px-5 text-sm transition-colors hover:border-[var(--surface-border-strong)]"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

function PasswordReset({
  onSubmit,
  onCancel,
}: {
  onSubmit: (password: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-sunken)] p-3">
      <p className="mb-2 text-xs text-[var(--text-secondary)]">
        تغيير كلمة المرور يُنهي كل جلسات هذا المستخدم فورًا.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="كلمة المرور الجديدة"
          dir="ltr"
          maxLength={200}
          aria-label="كلمة المرور الجديدة"
          className={cn(inputClass, 'min-w-[12rem] flex-1 text-start')}
        />

        <button
          type="button"
          disabled={saving || password.length === 0}
          onClick={async () => {
            setSaving(true);
            await onSubmit(password);
            setSaving(false);
          }}
          className="tap-target rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] disabled:opacity-50"
        >
          {saving ? 'جارٍ…' : 'تغيير'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--surface-border)] px-4 text-sm"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
