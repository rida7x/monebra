import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { validateCart, type CartInputLine } from '@/lib/services/cart';
import { computeOrderTotals, buildDiscountBreakdown } from '@/lib/services/pricing';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/utils';
import {
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_START,
  ORDER_STATUS_LABELS,
  STOCK_RESTORING_STATUSES,
  canTransition,
  type OrderStatus,
} from '@/lib/constants';

/**
 * إنشاء الطلبات وإدارتها.
 *
 * كل ما يمسّ الطلب أو المخزون يحدث داخل معاملة واحدة (transaction):
 * إنشاء الطلب، خصم المخزون، تسجيل الحركات، تحديث إحصائيات العميل والمنتج،
 * وإشعار المدير. إن فشلت أي خطوة يُلغى كل شيء ولا يبقى طلب معلّق ولا مخزون
 * منقوص بلا مقابل.
 *
 * خصم المخزون يستخدم `updateMany` بشرط `stock >= quantity` ويتحقق من عدد
 * الصفوف المتأثرة. عند طلبين متزامنين على آخر قطعة، ينجح أحدهما فقط
 * ويفشل الآخر برسالة واضحة — لا بيع زائد.
 */

export type CreateOrderInput = {
  lines: CartInputLine[];
  customerName: string;
  customerPhone: string;
  cityId: string;
  areaId?: string | null;
  addressLine: string;
  notes?: string | null;
  couponCode?: string | null;
  /** يصل مُتحقَّقًا منه من نقطة النهاية — انظر `isPaymentMethodEnabled` */
  paymentMethod?: string | null;
  deviceType?: string | null;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type CreateOrderFailure =
  | { ok: false; code: 'orders_disabled'; message: string }
  | { ok: false; code: 'empty_cart'; message: string }
  | { ok: false; code: 'invalid_delivery'; message: string }
  | { ok: false; code: 'invalid_phone'; message: string }
  | { ok: false; code: 'blocked'; message: string }
  | { ok: false; code: 'out_of_stock'; message: string; items: string[] }
  | { ok: false; code: 'cart_changed'; message: string; items: string[] };

export type CreateOrderResult =
  | { ok: true; orderNumber: string; orderId: string; total: number }
  | CreateOrderFailure;

export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const settings = await getSettings();

  if (!settings.ordersEnabled) {
    return {
      ok: false,
      code: 'orders_disabled',
      message: 'استقبال الطلبات متوقّف مؤقتًا. تواصل معنا لإتمام طلبك.',
    };
  }

  const phone = normalizePhone(input.customerPhone);
  if (!phone) {
    return {
      ok: false,
      code: 'invalid_phone',
      message: 'رقم الهاتف غير صحيح. أدخل رقمًا ليبيًا صالحًا.',
    };
  }

  // ── إعادة تسعير السلة من قاعدة البيانات ──
  const cart = await validateCart(input.lines);

  // إذا تغيّر شيء بين عرض السلة وإرسال الطلب، نوقف ونُعلم العميل بدل أن
  // ننشئ طلبًا بمحتوى مختلف عمّا وافق عليه.
  //
  // الترتيب مهم: نفحص أسباب السقوط *قبل* «السلة فارغة». عند تسابق طلبين
  // على آخر قطعة يخسر أحدهما، فتسقط كل أصنافه ويصبح عدد الأصناف صفرًا —
  // ولو فحصنا الفراغ أولًا لقلنا له «سلّتك فارغة» وهي رسالة مضللة، بينما
  // السبب الحقيقي أن الكمية نفدت للتو.
  const blocking = cart.issues.filter(
    (issue) => issue.type !== 'quantity_reduced',
  );

  if (blocking.length > 0) {
    return {
      ok: false,
      code: 'out_of_stock',
      message: 'نفدت الكمية المطلوبة من بعض المنتجات. راجع سلّتك ثم أعد المحاولة.',
      items: blocking.map((issue) => issue.name),
    };
  }

  if (cart.items.length === 0) {
    return {
      ok: false,
      code: 'empty_cart',
      message: 'سلّتك فارغة.',
    };
  }

  if (cart.issues.length > 0) {
    return {
      ok: false,
      code: 'cart_changed',
      message: 'تغيّرت الكميات المتاحة. راجع سلّتك ثم أعد المحاولة.',
      items: cart.issues.map((issue) => issue.name),
    };
  }

  // ── الإجماليات ──
  const totals = await computeOrderTotals({
    cart,
    cityId: input.cityId,
    areaId: input.areaId,
    couponCode: input.couponCode,
    customerPhone: phone,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
  });

  if (!totals.delivery) {
    return {
      ok: false,
      code: 'invalid_delivery',
      message: 'المدينة أو المنطقة المختارة غير متاحة للتوصيل.',
    };
  }

  // الافتراض الآمن عند الغياب: الدفع عند الاستلام
  const paymentMethod = input.paymentMethod || 'cod';

  const customerName = input.customerName.trim().slice(0, 120);
  const addressLine = input.addressLine.trim().slice(0, 500);
  const notes = input.notes?.trim().slice(0, 1000) || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── العميل ──
      const existing = await tx.customer.findUnique({
        where: { phone },
        select: { id: true, isBlocked: true },
      });

      if (existing?.isBlocked) {
        throw new BlockedCustomerError();
      }

      const customer = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: {
              name: customerName,
              ordersCount: { increment: 1 },
              totalSpent: { increment: totals.total },
            },
            select: { id: true },
          })
        : await tx.customer.create({
            data: {
              phone,
              name: customerName,
              ordersCount: 1,
              totalSpent: totals.total,
            },
            select: { id: true },
          });

      // ── خصم المخزون قبل إنشاء الطلب ──
      // الترتيب مقصود: لو فشل الخصم لا يبقى طلب معلّق حتى داخل السجلات
      const failed: string[] = [];

      for (const item of cart.items) {
        const updated = await tx.productVariant.updateMany({
          // الشرط `stock >= quantity` هو الحارس ضد البيع الزائد
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count !== 1) {
          failed.push(`${item.productName} — ${item.variantLabel}`);
        }
      }

      if (failed.length > 0) {
        throw new StockConflictError(failed);
      }

      // ── رقم الطلب ──
      const orderNumber = await nextOrderNumber(tx);

      // ── الطلب ──
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,

          customerName,
          customerPhone: phone,
          cityId: totals.delivery!.cityId,
          areaId: totals.delivery!.areaId,
          cityName: totals.delivery!.cityName,
          areaName: totals.delivery!.areaName,
          addressLine,
          notes,

          /**
           * ⚠️ `paymentStatus` يبقى `pending` للطرق الإلكترونية حتى يصل
           * تأكيد المصرف. تعليمه `paid` عند الإنشاء يعني تسليم بضاعة قد
           * لا يكون ثمنها وصل — والخطأ لا يظهر إلا في الجرد.
           */
          paymentMethod: paymentMethod,
          paymentStatus: 'pending',

          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          deliveryFee: totals.deliveryFee,
          total: totals.total,

          couponId: totals.coupon?.id ?? null,
          couponCode: totals.coupon?.code ?? null,
          discountBreakdown: buildDiscountBreakdown(totals),

          deviceType: input.deviceType ?? null,
          referrer: input.referrer?.slice(0, 500) ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,

          stockApplied: true,

          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              // نسخة كاملة — تبقى الفاتورة صحيحة لو حُذف المنتج أو تغيّر سعره
              productName: item.productName,
              variantLabel: item.variantLabel,
              imageUrl: item.image,
              productSlug: item.productSlug,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },

          statusHistory: {
            create: { toStatus: 'new', note: 'أُنشئ الطلب من المتجر' },
          },
        },
        select: { id: true, orderNumber: true, total: true },
      });

      // ── سجل حركات المخزون ──
      for (const item of cart.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            delta: -item.quantity,
            reason: 'order',
            stockAfter: variant?.stock ?? 0,
            orderId: order.id,
            note: `طلب ${order.orderNumber}`,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.quantity } },
        });
      }

      // ── الكوبون ──
      if (totals.coupon) {
        await tx.coupon.update({
          where: { id: totals.coupon.id },
          data: { usageCount: { increment: 1 } },
        });

        await tx.couponUsage.create({
          data: {
            couponId: totals.coupon.id,
            orderId: order.id,
            customerId: customer.id,
            amount: totals.coupon.amount,
          },
        });
      }

      // ── إشعار المدير ──
      await tx.notification.create({
        data: {
          type: 'new_order',
          title: `طلب جديد ${order.orderNumber}`,
          body: `${customerName} — ${totals.delivery!.cityName}`,
          entityType: 'order',
          entityId: order.id,
        },
      });

      // ── تنبيه المخزون المنخفض ──
      if (settings.lowStockAlert) {
        await createLowStockNotifications(tx, cart.items.map((i) => i.variantId));
      }

      // ── تحليلات ──
      await tx.analyticsEvent.create({
        data: {
          type: 'purchase',
          deviceType: input.deviceType ?? null,
          meta: JSON.stringify({
            orderNumber: order.orderNumber,
            total: order.total,
            items: cart.items.length,
          }),
        },
      });

      return order;
    });

    return {
      ok: true,
      orderId: result.id,
      orderNumber: result.orderNumber,
      total: result.total,
    };
  } catch (error) {
    if (error instanceof StockConflictError) {
      return {
        ok: false,
        code: 'out_of_stock',
        message:
          'نفدت الكمية المطلوبة من بعض المنتجات للتو. راجع سلّتك ثم أعد المحاولة.',
        items: error.items,
      };
    }

    if (error instanceof BlockedCustomerError) {
      return {
        ok: false,
        code: 'blocked',
        message: 'تعذّر إنشاء الطلب. تواصل معنا لمساعدتك.',
      };
    }

    throw error;
  }
}

class StockConflictError extends Error {
  constructor(readonly items: string[]) {
    super('stock conflict');
    this.name = 'StockConflictError';
  }
}

class BlockedCustomerError extends Error {
  constructor() {
    super('blocked customer');
    this.name = 'BlockedCustomerError';
  }
}

/**
 * رقم طلب فريد ومتسلسل: MON-10025
 *
 * يستخدم صف عدّاد داخل نفس المعاملة، فحتى مع طلبين في نفس اللحظة يحصل كل
 * منهما على رقم مختلف. أفضل من الاعتماد على `count()` الذي يعطي نفس الرقم
 * لطلبين متزامنين.
 */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { key: 'order_number' },
    create: { key: 'order_number', value: ORDER_NUMBER_START + 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return `${ORDER_NUMBER_PREFIX}-${counter.value}`;
}

/** ينشئ تنبيهًا لكل حجم وصل إلى عتبة المخزون المنخفض */
async function createLowStockNotifications(
  tx: Prisma.TransactionClient,
  variantIds: string[],
): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      label: true,
      stock: true,
      lowStockThreshold: true,
      product: { select: { name: true } },
    },
  });

  for (const variant of variants) {
    if (variant.stock > variant.lowStockThreshold) continue;

    await tx.notification.create({
      data: {
        type: 'low_stock',
        title:
          variant.stock === 0
            ? `نفد المخزون: ${variant.product.name}`
            : `مخزون منخفض: ${variant.product.name}`,
        body: `${variant.label} — المتبقي ${variant.stock}`,
        entityType: 'variant',
        entityId: variant.id,
      },
    });
  }
}

// ─────────────────────────── تغيير الحالة ───────────────────────────

export type StatusChangeResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * تغيير حالة الطلب مع أثره على المخزون.
 *
 * • الانتقالات المسموحة معرّفة في `ORDER_STATUS_TRANSITIONS` وتُفرض هنا
 * • الإلغاء أو الإرجاع يعيد المخزون **مرة واحدة فقط** بحراسة `stockRestored`
 * • كل تغيير يُسجَّل في `order_status_history` باسم من نفّذه
 */
export async function changeOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  adminId: string | null,
  note?: string | null,
): Promise<StatusChangeResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        stockApplied: true,
        stockRestored: true,
        items: {
          select: { variantId: true, quantity: true, productName: true },
        },
      },
    });

    if (!order) return { ok: false, message: 'الطلب غير موجود' };

    const fromStatus = order.status as OrderStatus;

    if (fromStatus === toStatus) {
      return { ok: false, message: 'الطلب في هذه الحالة بالفعل' };
    }

    if (!canTransition(fromStatus, toStatus)) {
      return {
        ok: false,
        message: `لا يمكن الانتقال من «${ORDER_STATUS_LABELS[fromStatus]}» إلى «${ORDER_STATUS_LABELS[toStatus]}»`,
      };
    }

    const restoresStock =
      STOCK_RESTORING_STATUSES.includes(toStatus) &&
      order.stockApplied &&
      !order.stockRestored;

    if (restoresStock) {
      for (const item of order.items) {
        if (!item.variantId) continue;

        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
          select: { stock: true },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            delta: item.quantity,
            reason: toStatus === 'cancelled' ? 'cancel' : 'return',
            stockAfter: variant.stock,
            orderId: order.id,
            adminId,
            note: `${ORDER_STATUS_LABELS[toStatus]} — ${order.orderNumber}`,
          },
        });
      }
    }

    const timestamps: Prisma.OrderUpdateInput = {};
    if (toStatus === 'confirmed') timestamps.confirmedAt = new Date();
    if (toStatus === 'delivered') timestamps.deliveredAt = new Date();
    if (toStatus === 'cancelled') timestamps.cancelledAt = new Date();

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: toStatus,
        ...(restoresStock ? { stockRestored: true } : {}),
        ...timestamps,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus,
        toStatus,
        adminId,
        note: note?.slice(0, 500) ?? null,
      },
    });

    return { ok: true };
  });
}

// ─────────────────────────── القراءة ───────────────────────────

/** تفاصيل الطلب لصفحة التأكيد وصفحة التتبّع */
export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      customerName: true,
      customerPhone: true,
      cityName: true,
      areaName: true,
      addressLine: true,
      notes: true,
      subtotal: true,
      discountTotal: true,
      deliveryFee: true,
      total: true,
      couponCode: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          variantLabel: true,
          imageUrl: true,
          productSlug: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: { toStatus: true, createdAt: true },
      },
    },
  });
}

export type OrderDetail = NonNullable<
  Awaited<ReturnType<typeof getOrderByNumber>>
>;

/**
 * تتبّع الطلب برقمه ورقم هاتف صاحبه.
 *
 * اشتراط الهاتف مقصود: رقم الطلب متسلسل ويسهل تخمينه، فبدونه يستطيع أي
 * شخص تصفّح طلبات الآخرين وقراءة عناوينهم وأرقامهم.
 */
export async function trackOrder(orderNumber: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const order = await getOrderByNumber(orderNumber);
  if (!order) return null;
  if (order.customerPhone !== normalized) return null;

  return order;
}
