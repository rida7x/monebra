import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createOrder } from '@/lib/services/orders';
import { sanitizeLines } from '@/lib/services/cart';
import { rateLimit, clientIp, deviceTypeOf, LIMITS } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/utils';
import { invalidateProduct } from '@/lib/cache';
import { logError } from '@/lib/logger';
import { MAX_CART_LINES } from '@/lib/constants';

/**
 * إنشاء طلب.
 *
 * الحماية على ثلاث طبقات:
 *  1. تحديد المعدّل بالـ IP — يمنع إغراق المتجر بطلبات وهمية
 *  2. Zod يتحقق من شكل المدخلات وطولها قبل لمس قاعدة البيانات
 *  3. `createOrder` يعيد حساب كل سعر من قاعدة البيانات ويخصم المخزون
 *     داخل معاملة واحدة
 *
 * لا يُقرأ أي مبلغ من جسم الطلب — العميل يرسل معرّفات وكميات فقط.
 */

const OrderSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1).max(64),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(MAX_CART_LINES),

  customerName: z
    .string()
    .trim()
    .min(2, 'الاسم قصير جدًا')
    .max(120, 'الاسم طويل جدًا'),

  customerPhone: z
    .string()
    .trim()
    .min(6)
    .max(25)
    .refine((value) => normalizePhone(value) !== null, {
      message: 'رقم الهاتف غير صحيح',
    }),

  cityId: z.string().min(1).max(64),
  areaId: z.string().max(64).nullish(),

  addressLine: z
    .string()
    .trim()
    .min(5, 'العنوان قصير جدًا — أضف تفاصيل أكثر')
    .max(500),

  notes: z.string().trim().max(1000).nullish(),
  couponCode: z.string().trim().max(40).nullish(),

  /** حقل فخّ: يملؤه الآليّ ولا يراه الإنسان */
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  try {
    // ── تحديد المعدّل ──
    const limit = await rateLimit(`order:${ip}`, LIMITS.order().limit, LIMITS.order().windowSeconds);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            'تجاوزت عدد المحاولات المسموح. انتظر قليلًا ثم أعد المحاولة، أو تواصل معنا.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = OrderSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? 'البيانات المُرسلة غير مكتملة' },
        { status: 400 },
      );
    }

    // الفخّ ممتلئ ⇒ آليّ. نعيد نجاحًا مزيفًا حتى لا يتعلّم الآليّ الصيغة
    if (parsed.data.website) {
      return NextResponse.json({ ok: true, orderNumber: 'MON-0' });
    }

    const userAgent = request.headers.get('user-agent');

    const result = await createOrder({
      lines: sanitizeLines(parsed.data.lines),
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      cityId: parsed.data.cityId,
      areaId: parsed.data.areaId ?? null,
      addressLine: parsed.data.addressLine,
      notes: parsed.data.notes ?? null,
      couponCode: parsed.data.couponCode ?? null,
      deviceType: deviceTypeOf(userAgent),
      referrer: request.headers.get('referer'),
      ip,
      userAgent,
    });

    if (!result.ok) {
      const status =
        result.code === 'orders_disabled'
          ? 503
          : result.code === 'out_of_stock' || result.code === 'cart_changed'
            ? 409
            : 400;

      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          items: 'items' in result ? result.items : undefined,
        },
        { status },
      );
    }

    // تحديث شارات «غير متوفر» في صفحات الكتالوج بعد خصم المخزون
    try {
      invalidateProduct();
    } catch {
      // الإبطال تحسين للعرض — لا يجوز أن يُفشل طلبًا نجح
    }

    return NextResponse.json(
      { ok: true, orderNumber: result.orderNumber, total: result.total },
      { status: 201 },
    );
  } catch (error) {
    await logError(error, { path: '/api/orders', ip });

    return NextResponse.json(
      {
        error:
          'تعذّر إنشاء الطلب حاليًا. لم يُخصم شيء من المخزون — حاول مرة أخرى أو تواصل معنا.',
      },
      { status: 500 },
    );
  }
}
