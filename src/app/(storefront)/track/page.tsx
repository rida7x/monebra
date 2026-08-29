import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackForm } from './TrackForm';
import { Skeleton } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'تتبّع طلبك',
  description: 'تابع حالة طلبك برقم الطلب ورقم هاتفك.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/track' },
};

/**
 * صفحة تتبّع الطلب.
 *
 * النموذج عميلي لأنه يقرأ `number` من الرابط (قادمًا من صفحة التأكيد)
 * ويرسل طلبًا للتحقق. `useSearchParams` يتطلب حدود Suspense.
 */
export default function TrackPage() {
  return (
    <main className="container-page py-10 sm:py-14">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">تتبّع طلبك</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          أدخل رقم الطلب ورقم هاتفك لمعرفة حالة طلبك.
        </p>
        <div className="mx-auto mt-4 h-px w-16 rule-gold" />
      </header>

      <Suspense
        fallback={
          <div className="surface-card mx-auto max-w-2xl space-y-4 p-6">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        }
      >
        <TrackForm />
      </Suspense>
    </main>
  );
}
