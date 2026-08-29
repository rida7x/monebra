'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Eye, EyeOff, LogIn } from 'lucide-react';

/**
 * نموذج تسجيل دخول المدير.
 *
 * لا يعرض أبدًا سبب الفشل بدقة — الخادم يعيد رسالة موحّدة عمدًا. مهمة
 * النموذج عرضها كما هي دون تفسير أو تخمين.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'تعذّر تسجيل الدخول');
        setLoading(false);
        return;
      }

      // الوجهة تأتي من الحارس عند محاولة فتح صفحة قبل الدخول.
      // نقبل المسارات الداخلية فقط — قيمة خارجية تفتح ثغرة تحويل مفتوح.
      const next = searchParams.get('next');
      const target =
        next && next.startsWith('/admin') && !next.startsWith('//')
          ? next
          : '/admin';

      router.replace(target);
      router.refresh();
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من الإنترنت.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-card p-6" noValidate>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            dir="ltr"
            autoFocus
            className="h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-3.5 text-start text-sm outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]"
          >
            كلمة المرور
          </label>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              dir="ltr"
              className="h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] ps-3.5 pe-12 text-start text-sm outline-none transition-colors focus:border-[var(--accent)]"
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="absolute end-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs leading-relaxed text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="tap-target mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden />
            جارٍ التحقق…
          </>
        ) : (
          <>
            <LogIn size={15} aria-hidden />
            تسجيل الدخول
          </>
        )}
      </button>
    </form>
  );
}
