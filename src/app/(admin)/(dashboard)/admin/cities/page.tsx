import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { CitiesManager } from '@/components/admin/CitiesManager';

export const metadata: Metadata = {
  title: 'المدن والتوصيل',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCitiesPage() {
  await requirePageAccess('cities.manage');

  const [cities, settings] = await Promise.all([
    prisma.city.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        deliveryFee: true,
        deliveryDays: true,
        isActive: true,
        _count: { select: { orders: true } },
        areas: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            deliveryFeeOverride: true,
            deliveryDaysOverride: true,
            isActive: true,
          },
        },
      },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/8 p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        رسوم التوصيل التي تضعها هنا هي ما يدفعه العميل فعلًا عند إتمام الطلب.
        المدينة المعطّلة لا تظهر له أصلًا.
      </p>

      <CitiesManager
        cities={cities.map((city) => ({
          id: city.id,
          name: city.name,
          deliveryFee: city.deliveryFee,
          deliveryDays: city.deliveryDays,
          isActive: city.isActive,
          orderCount: city._count.orders,
          areas: city.areas,
        }))}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
}
