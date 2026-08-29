import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TableWrap, Table, Th, Td, PanelEmpty } from '@/components/admin/ui';
import { formatDate, timeAgo } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'سجل الأخطاء',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * سجل الأخطاء.
 *
 * العميل لا يرى أبدًا رسالة تقنية — يرى جملة عربية مفهومة، والتفاصيل
 * الكاملة تُحفظ هنا. هذه الصفحة أول ما يُراجَع عند شكوى «الموقع لا يعمل».
 */
export default async function AdminLogsPage() {
  await requirePageAccess('logs.view');

  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      level: true,
      message: true,
      path: true,
      context: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        آخر{' '}
        <span className="tabular font-semibold text-[var(--text-primary)]">
          {logs.length}
        </span>{' '}
        خطأ مسجّل
      </p>

      <TableWrap>
        {logs.length === 0 ? (
          <PanelEmpty message="لا توجد أخطاء مسجّلة — هذا خبر جيد" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>المستوى</Th>
                <Th>الرسالة</Th>
                <Th>المسار</Th>
                <Th>الوقت</Th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td>
                    <span
                      className={
                        log.level === 'error'
                          ? 'rounded-full bg-[var(--color-danger)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)]'
                          : 'rounded-full bg-[var(--color-warning)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--color-warning)]'
                      }
                    >
                      {log.level === 'error' ? 'خطأ' : 'تحذير'}
                    </span>
                  </Td>

                  <Td className="max-w-[30rem]">
                    <span className="block truncate text-sm" title={log.message}>
                      {log.message}
                    </span>
                    {log.context ? (
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        {log.context}
                      </span>
                    ) : null}
                  </Td>

                  <Td dir="ltr" className="text-start text-xs text-[var(--text-secondary)]">
                    {log.path ?? '—'}
                  </Td>

                  <Td
                    className="whitespace-nowrap text-xs text-[var(--text-muted)]"
                    title={formatDate(log.createdAt, 'datetime')}
                  >
                    {timeAgo(log.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
    </div>
  );
}
