import { ProductGridSkeleton, Skeleton } from '@/components/ui/primitives';

/**
 * هيكل التحميل لصفحة نتائج البحث.
 *
 * ⚠️ لا تضع loading.tsx على مستوى مجموعة (storefront): وجوده هناك ينشئ
 * حدود Suspense حول كل صفحة، فيبدأ بثّ الاستجابة بحالة 200 قبل أن يُنفَّذ
 * notFound()، ويصبح مستحيلًا إرجاع 404 حقيقية للمنتجات والتصنيفات غير
 * الموجودة. لذلك يوضع فقط على المسارات التي لا تستدعي notFound.
 */
export default function StorefrontLoading() {
  return (
    <main className="container-page py-10 sm:py-14" aria-busy="true">
      <span className="sr-only">جارٍ التحميل…</span>

      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-px w-16" />
      </div>

      <ProductGridSkeleton count={8} />
    </main>
  );
}
