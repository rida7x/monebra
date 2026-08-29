import type { Metadata } from 'next';
import { getDeliveryOptions } from '@/lib/services/delivery';
import { CheckoutForm } from './CheckoutForm';
import { EmptyState } from '@/components/ui/primitives';
import { MapPinOff } from 'lucide-react';

export const metadata: Metadata = {
  title: 'إتمام الطلب',
  robots: { index: false, follow: false },
};

/**
 * صفحة إتمام الطلب.
 *
 * المدن تُحمَّل على الخادم فتصل جاهزة مع أول رسم — لا انتظار ولا قائمة
 * فارغة تومض. محتوى السلة عميلي لأنه محفوظ في متصفح الزائر.
 */
export default async function CheckoutPage() {
  const cities = await getDeliveryOptions();

  return (
    <main className="container-page py-10 sm:py-14">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">إتمام الطلب</h1>
        <div className="mx-auto mt-4 h-px w-16 rule-gold" />
      </header>

      {cities.length === 0 ? (
        <EmptyState
          icon={<MapPinOff size={40} />}
          title="لا توجد مدن متاحة للتوصيل"
          description="لم تُضَف مدن التوصيل بعد. تواصل معنا لإتمام طلبك."
          action={{ href: '/cart', label: 'العودة إلى السلة' }}
        />
      ) : (
        <CheckoutForm cities={cities} />
      )}
    </main>
  );
}
