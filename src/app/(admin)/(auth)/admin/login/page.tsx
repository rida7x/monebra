import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSettings } from '@/lib/settings';
import { LoginForm } from './LoginForm';
import { Skeleton } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const settings = await getSettings();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-3xl tracking-wide text-[var(--accent)]">
            {settings.storeName}
          </span>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            لوحة التحكم
          </p>
          <div className="mx-auto mt-4 h-px w-14 rule-gold" />
        </div>

        <Suspense
          fallback={
            <div className="surface-card space-y-4 p-6">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
