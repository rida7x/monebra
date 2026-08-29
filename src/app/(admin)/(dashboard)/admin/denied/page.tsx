import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { requirePageAccess } from '@/lib/auth';
import { ADMIN_ROLE_LABELS, type AdminRole } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'صلاحية غير كافية',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * صفحة «ليست لديك صلاحية».
 *
 * تُوضّح للموظف سبب المنع بدقة — دوره الحالي والصلاحية الناقصة — بدل
 * رسالة خطأ عامة تجعله يظن أن الموقع معطّل ويفتح بلاغًا بلا داعٍ.
 */
export default async function AdminDeniedPage({ searchParams }: PageProps) {
  const user = await requirePageAccess();

  const params = await searchParams;
  const raw = params.p;
  const permission = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-warning)]/15"
        aria-hidden
      >
        <ShieldAlert size={30} className="text-[var(--color-warning)]" />
      </div>

      <h1 className="text-xl font-semibold">ليست لديك صلاحية لهذه الصفحة</h1>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        دورك الحالي{' '}
        <span className="font-semibold text-[var(--text-primary)]">
          {ADMIN_ROLE_LABELS[user.role as AdminRole] ?? user.role}
        </span>
        {permission ? (
          <>
            {' '}
            ولا يشمل صلاحية{' '}
            <code
              dir="ltr"
              className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs"
            >
              {permission}
            </code>
          </>
        ) : null}
        . اطلب من المدير العام منحك هذه الصلاحية إن كنت تحتاجها.
      </p>

      <Link
        href="/admin"
        className="tap-target mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        <ArrowRight size={15} aria-hidden />
        العودة إلى لوحة المعلومات
      </Link>
    </div>
  );
}
