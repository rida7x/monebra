import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CheckCircle2, MessageCircle, Package, Copy } from 'lucide-react';
import { getOrderByNumber } from '@/lib/services/orders';
import { getSettings, whatsappLink } from '@/lib/settings';
import { OrderSummaryCard } from '@/components/order/OrderSummaryCard';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { decodeSlug } from '@/lib/utils';

/**
 * ⚠️ لا `revalidate` ولا `generateStaticParams` هنا: صفحة الطلب شخصية
 * وتتغير حالتها، ويجب أن تُقرأ لحظيًا من قاعدة البيانات.
 */
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ number: string }> };

const loadOrder = cache(async (number: string) => getOrderByNumber(number));

/**
 * ⚠️ `notFound()` تُستدعى هنا أيضًا لا في الصفحة وحدها — وإلا ثبّت Next
 * حالة 200 قبل أن تُنفَّذ. راجع «قواعد لا تُخالَف» في README.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { number: rawNumber } = await params;
  const number = decodeSlug(rawNumber);
  const order = await loadOrder(number);

  if (!order) notFound();

  return {
    title: `الطلب ${order.orderNumber}`,
    // صفحات الطلبات تحتوي بيانات شخصية — لا تُفهرس ولا تُتبع روابطها
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * صفحة تأكيد الطلب.
 *
 * الرابط يحتوي رقم الطلب فقط، فهو قابل للمشاركة عن طريق الخطأ. لذلك:
 *  • `noindex, nofollow, nocache` في البيانات الوصفية
 *  • لا نعرض رقم الهاتف كاملًا... بل نعرضه لأن العميل نفسه هو من وصل عبر
 *    الشراء مباشرة؛ أما التتبّع لاحقًا فيمرّ عبر /track ويشترط الهاتف.
 */
export default async function OrderSuccessPage({ params }: PageProps) {
  const { number: rawNumber } = await params;
  const number = decodeSlug(rawNumber);
  const order = await loadOrder(number);

  if (!order) notFound();

  const settings = await getSettings();

  const whatsapp = whatsappLink(
    settings.whatsappNumber,
    `مرحبًا، أريد الاستفسار عن الطلب ${order.orderNumber}`,
  );

  return (
    <main className="container-page py-10 sm:py-14">
      <CheckoutSteps current={2} />

      {/* ── رسالة النجاح ── */}
      <div className="mb-10 text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/15"
          aria-hidden
        >
          <CheckCircle2 size={32} className="text-[var(--color-success)]" />
        </div>

        <h1 className="text-2xl font-semibold sm:text-3xl">
          تم استلام طلبك بنجاح ❤️
        </h1>

        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          شكرًا لثقتك بنا. احتفظ برقم طلبك لمتابعته لاحقًا.
        </p>

        <p className="mt-6 inline-flex items-center gap-3 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/8 px-6 py-3">
          <Package size={17} className="text-[var(--accent)]" aria-hidden />
          {/* التسمية مسموعة لقارئ الشاشة ومخفية بصريًا — الرقم وحده
              بلا سياق يُنطق كأرقام مبعثرة */}
          <span className="sr-only">رقم الطلب</span>
          <span
            data-order-number
            className="tabular text-lg font-bold text-[var(--accent)]"
          >
            {order.orderNumber}
          </span>
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/track?number=${encodeURIComponent(order.orderNumber)}`}
            className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--surface-border-strong)] px-6 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
          >
            <Copy size={15} aria-hidden />
            تتبّع الطلب
          </Link>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366]/40 px-6 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white sm:w-auto"
            >
              <MessageCircle size={15} aria-hidden />
              استفسر عبر واتساب
            </a>
          ) : null}

          <Link
            href="/products"
            className="tap-target inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
          >
            متابعة التسوّق
          </Link>
        </div>
      </div>

      <OrderSummaryCard
        order={order}
        currency={{
          symbol: settings.currencySymbol,
          decimals: settings.currencyDecimals,
        }}
      />
    </main>
  );
}
