import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const metadata: Metadata = {
  title: 'الإعدادات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requirePageAccess('settings.manage');
  const settings = await getSettings();

  return <SettingsForm settings={settings} />;
}
