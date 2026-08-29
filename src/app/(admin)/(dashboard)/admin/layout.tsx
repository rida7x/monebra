import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * تخطيط صفحات اللوحة (ما عدا صفحة الدخول).
 *
 * هنا يقع **التحقق الحقيقي** من الجلسة: `proxy.ts` يتحقق من وجود الكوكي
 * فقط، أما صحة الرمز وانتهاء الجلسة وتفعيل الحساب فتُفحص هنا عند كل طلب.
 * وكل صفحة داخلية تضيف فحص صلاحيتها الخاصة عبر `requirePageAccess(permission)`.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAdmin();

  // `expired=1` يخبر الوسيط أن الكوكي فاسد فيحذفه — بدونها تنشأ حلقة
  // تحويل لا نهائية (الوسيط يرى كوكيًا فيعيدنا إلى اللوحة، واللوحة تجده
  // غير صالح فتعيدنا إلى الدخول). انظر التعليق في `requirePageAccess`.
  if (!user) redirect('/admin/login?expired=1');

  const [settings, unreadCount] = await Promise.all([
    getSettings(),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: [...user.permissions],
      }}
      storeName={settings.storeName}
      unreadCount={unreadCount}
    >
      {children}
    </AdminShell>
  );
}
