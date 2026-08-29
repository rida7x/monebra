import { prisma } from '@/lib/db';
import { percentOf } from '@/lib/money';
import type { ValidatedCart } from '@/lib/services/cart';
import { resolveDelivery, type ResolvedDelivery } from '@/lib/services/delivery';

/**
 * محرّك التسعير.
 *
 * ⚠️ هذه الدالة هي المصدر الوحيد لأي إجمالي في النظام. تستدعيها صفحة إتمام
 * الطلب لعرض الملخّص، ويستدعيها إنشاء الطلب داخل المعاملة — بنفس المدخلات
 * وبنفس المنطق. لذلك يستحيل أن يختلف ما يراه العميل عمّا يُسجَّل في الطلب.
 *
 * ترتيب الحساب مقصود:
 *   المجموع الفرعي (من أسعار قاعدة البيانات)
 *   − خصم الكوبون (محسوب على المجموع الفرعي وحده، لا على التوصيل)
 *   + رسوم التوصيل (تُلغى إذا تجاوز المجموع بعد الخصم عتبة التوصيل المجاني)
 *   = الإجمالي النهائي
 */

export type CouponRejection =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'customer_limit'
  | 'min_order'
  | 'no_eligible_items';

export const COUPON_ERRORS: Record<CouponRejection, string> = {
  not_found: 'كود الخصم غير صحيح',
  inactive: 'هذا الكود غير مفعّل',
  not_started: 'هذا الكود لم يبدأ بعد',
  expired: 'انتهت صلاحية هذا الكود',
  usage_limit: 'تم استخدام هذا الكود بالكامل',
  customer_limit: 'استخدمت هذا الكود من قبل',
  min_order: 'قيمة طلبك أقل من الحد الأدنى لهذا الكود',
  no_eligible_items: 'هذا الكود لا ينطبق على المنتجات في سلّتك',
};

export type AppliedCoupon = {
  id: string;
  code: string;
  amount: number;
  description: string | null;
};

export type OrderTotals = {
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  savings: number;
  freeDeliveryApplied: boolean;
  coupon: AppliedCoupon | null;
  couponError: string | null;
  delivery: ResolvedDelivery | null;
};

/** تفصيل الخصومات المحفوظ داخل الطلب — يشرح لاحقًا كيف تكوّن الإجمالي */
export type DiscountBreakdown = {
  couponCode?: string;
  couponAmount?: number;
  freeDelivery?: boolean;
};

type ComputeInput = {
  cart: ValidatedCart;
  cityId?: string | null;
  areaId?: string | null;
  couponCode?: string | null;
  /** رقم هاتف العميل — للتحقق من حد الاستخدام لكل عميل */
  customerPhone?: string | null;
  freeDeliveryThreshold: number;
};

export async function computeOrderTotals({
  cart,
  cityId,
  areaId,
  couponCode,
  customerPhone,
  freeDeliveryThreshold,
}: ComputeInput): Promise<OrderTotals> {
  const subtotal = cart.subtotal;

  // ── الكوبون ──
  let coupon: AppliedCoupon | null = null;
  let couponError: string | null = null;

  if (couponCode && couponCode.trim()) {
    const result = await evaluateCoupon(
      couponCode.trim(),
      cart,
      customerPhone ?? null,
    );

    if ('error' in result) {
      couponError = COUPON_ERRORS[result.error];
    } else {
      coupon = result.coupon;
    }
  }

  const discountTotal = coupon?.amount ?? 0;
  const afterDiscount = Math.max(0, subtotal - discountTotal);

  // ── التوصيل ──
  const delivery = cityId ? await resolveDelivery(cityId, areaId) : null;

  const freeDeliveryApplied =
    freeDeliveryThreshold > 0 && afterDiscount >= freeDeliveryThreshold;

  const deliveryFee = freeDeliveryApplied ? 0 : (delivery?.fee ?? 0);

  return {
    subtotal,
    discountTotal,
    deliveryFee,
    total: afterDiscount + deliveryFee,
    savings: cart.savings + discountTotal,
    freeDeliveryApplied,
    coupon,
    couponError,
    delivery,
  };
}

export function buildDiscountBreakdown(totals: OrderTotals): string | null {
  const breakdown: DiscountBreakdown = {};

  if (totals.coupon) {
    breakdown.couponCode = totals.coupon.code;
    breakdown.couponAmount = totals.coupon.amount;
  }
  if (totals.freeDeliveryApplied) {
    breakdown.freeDelivery = true;
  }

  return Object.keys(breakdown).length > 0 ? JSON.stringify(breakdown) : null;
}

// ───────────────────────────── الكوبونات ─────────────────────────────

type CouponResult = { coupon: AppliedCoupon } | { error: CouponRejection };

/**
 * يتحقق من الكوبون ويحسب قيمة خصمه.
 *
 * كل الشروط تُفحص على الخادم: التفعيل، النافذة الزمنية، حد الاستخدام الكلي،
 * حد الاستخدام لكل عميل، الحد الأدنى للطلب، والمنتجات/التصنيفات المشمولة.
 */
export async function evaluateCoupon(
  code: string,
  cart: ValidatedCart,
  customerPhone: string | null,
): Promise<CouponResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
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
      scope: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      targets: { select: { productId: true, categoryId: true } },
    },
  });

  if (!coupon) return { error: 'not_found' };
  if (!coupon.isActive) return { error: 'inactive' };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { error: 'not_started' };
  if (coupon.endsAt && coupon.endsAt < now) return { error: 'expired' };

  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { error: 'usage_limit' };
  }

  // ── الأصناف المشمولة ──
  const eligible = await eligibleItems(cart, coupon);
  if (eligible.length === 0) return { error: 'no_eligible_items' };

  const eligibleTotal = eligible.reduce((sum, item) => sum + item.lineTotal, 0);

  // الحد الأدنى يُقاس على مجموع السلة كاملًا، لا على الأصناف المشمولة فقط
  if (cart.subtotal < coupon.minOrderTotal) return { error: 'min_order' };

  // ── حد الاستخدام لكل عميل ──
  if (coupon.perCustomerLimit !== null && customerPhone) {
    const used = await prisma.couponUsage.count({
      where: { couponId: coupon.id, customer: { phone: customerPhone } },
    });

    if (used >= coupon.perCustomerLimit) return { error: 'customer_limit' };
  }

  // ── قيمة الخصم ──
  let amount =
    coupon.type === 'percent'
      ? percentOf(eligibleTotal, coupon.value)
      : coupon.value;

  if (coupon.maxDiscount !== null) {
    amount = Math.min(amount, coupon.maxDiscount);
  }

  // لا يتجاوز الخصم قيمة الأصناف المشمولة أبدًا
  amount = Math.min(amount, eligibleTotal);

  if (amount <= 0) return { error: 'no_eligible_items' };

  return {
    coupon: {
      id: coupon.id,
      code: coupon.code,
      amount,
      description: coupon.description,
    },
  };
}

type CouponShape = {
  scope: string;
  targets: { productId: string | null; categoryId: string | null }[];
};

/** الأصناف التي ينطبق عليها الكوبون حسب نطاقه */
async function eligibleItems(cart: ValidatedCart, coupon: CouponShape) {
  if (coupon.scope === 'all' || coupon.targets.length === 0) {
    return cart.items;
  }

  const productIds = new Set(
    coupon.targets
      .map((target) => target.productId)
      .filter((id): id is string => Boolean(id)),
  );

  const categoryIds = coupon.targets
    .map((target) => target.categoryId)
    .filter((id): id is string => Boolean(id));

  if (categoryIds.length > 0) {
    const inCategories = await prisma.product.findMany({
      where: {
        id: { in: cart.items.map((item) => item.productId) },
        categoryId: { in: categoryIds },
      },
      select: { id: true },
    });

    for (const product of inCategories) productIds.add(product.id);
  }

  return cart.items.filter((item) => productIds.has(item.productId));
}
