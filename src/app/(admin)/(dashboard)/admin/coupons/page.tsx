import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { CouponsManager } from '@/components/admin/CouponsManager';

export const metadata: Metadata = {
  title: 'الكوبونات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  await requirePageAccess('coupons.manage');

  const [coupons, settings] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrderTotal: true,
        maxDiscount: true,
        usageLimit: true,
        usageCount: true,
        perCustomerLimit: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        _count: { select: { orders: true } },
      },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/8 p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        يُدخل العميل الكود في صفحة إتمام الطلب، والخادم يتحقق من كل الشروط
        قبل تطبيق الخصم — لا يمكن تجاوزها من المتصفح.
      </p>

      <CouponsManager
        coupons={coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          minOrderTotal: coupon.minOrderTotal,
          maxDiscount: coupon.maxDiscount,
          usageLimit: coupon.usageLimit,
          usageCount: coupon.usageCount,
          perCustomerLimit: coupon.perCustomerLimit,
          startsAt: coupon.startsAt,
          endsAt: coupon.endsAt,
          isActive: coupon.isActive,
          orderCount: coupon._count.orders,
        }))}
        currencySymbol={settings.currencySymbol}
        currencyDecimals={settings.currencyDecimals}
      />
    </div>
  );
}
