import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UsersManager } from '@/components/admin/UsersManager';

export const metadata: Metadata = {
  title: 'المستخدمون',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const current = await requirePageAccess('users.manage');

  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return <UsersManager users={users} currentUserId={current.id} />;
}
