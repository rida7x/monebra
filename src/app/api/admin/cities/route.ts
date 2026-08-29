import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { invalidateCities } from '@/lib/cache';
import { toMinor } from '@/lib/money';
import { logError } from '@/lib/logger';

/**
 * إدارة المدن والمناطق ورسوم التوصيل.
 *
 * ⚠️ الرسوم تصل بالصيغة المعروضة (10.5) وتُحوَّل هنا إلى الوحدة الصغرى.
 * `deliveryFeeOverride = null` في المنطقة يعني «استخدم رسم المدينة» — وهو
 * مختلف عن الصفر الذي يعني «توصيل مجاني لهذه المنطقة».
 */

const AreaSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, 'اسم المنطقة مطلوب').max(80),
  /** null = ترث رسم المدينة */
  deliveryFee: z.number().min(0).max(100_000).nullish(),
  deliveryDays: z.string().trim().max(60).nullish(),
  isActive: z.boolean(),
});

const CitySchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, 'اسم المدينة مطلوب').max(80),
  deliveryFee: z.number().min(0).max(100_000),
  deliveryDays: z.string().trim().max(60).nullish(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  areas: z.array(AreaSchema).max(60),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('cities.manage');

    const body = await request.json().catch(() => null);
    const parsed = CitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات المدينة غير مكتملة' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // اسم المدينة فريد — نتحقق مبكرًا لنعطي رسالة مفهومة بدل خطأ قاعدة بيانات
    const clash = await prisma.city.findUnique({
      where: { name: data.name },
      select: { id: true },
    });

    if (clash && clash.id !== data.id) {
      return NextResponse.json(
        { error: 'توجد مدينة بهذا الاسم بالفعل' },
        { status: 409 },
      );
    }

    const cityId = await prisma.$transaction(async (tx) => {
      const city = data.id
        ? await tx.city.update({
            where: { id: data.id },
            data: {
              name: data.name,
              deliveryFee: toMinor(data.deliveryFee),
              deliveryDays: data.deliveryDays || null,
              isActive: data.isActive,
              ...(data.sortOrder !== undefined
                ? { sortOrder: data.sortOrder }
                : {}),
            },
            select: { id: true },
          })
        : await tx.city.create({
            data: {
              name: data.name,
              deliveryFee: toMinor(data.deliveryFee),
              deliveryDays: data.deliveryDays || null,
              isActive: data.isActive,
              sortOrder: data.sortOrder ?? 0,
            },
            select: { id: true },
          });

      const existingAreas = await tx.area.findMany({
        where: { cityId: city.id },
        select: { id: true, _count: { select: { orders: true } } },
      });

      const kept = new Set(
        data.areas.map((area) => area.id).filter(Boolean) as string[],
      );

      for (const [index, area] of data.areas.entries()) {
        const payload = {
          name: area.name,
          deliveryFeeOverride:
            area.deliveryFee == null ? null : toMinor(area.deliveryFee),
          deliveryDaysOverride: area.deliveryDays || null,
          isActive: area.isActive,
          sortOrder: index,
        };

        if (area.id && existingAreas.some((row) => row.id === area.id)) {
          await tx.area.update({ where: { id: area.id }, data: payload });
        } else {
          await tx.area.create({ data: { ...payload, cityId: city.id } });
        }
      }

      // المنطقة التي لها طلبات تُعطَّل ولا تُحذف — حذفها يُفرغ مرجع الطلب
      for (const area of existingAreas) {
        if (kept.has(area.id)) continue;

        if (area._count.orders > 0) {
          await tx.area.update({
            where: { id: area.id },
            data: { isActive: false },
          });
        } else {
          await tx.area.delete({ where: { id: area.id } });
        }
      }

      return city.id;
    });

    invalidateCities();
    return NextResponse.json({ ok: true, id: cityId });
  } catch (error) {
    return handleAdminError(error, 'POST /api/admin/cities');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin('cities.manage');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرّف المدينة مفقود' }, { status: 400 });
    }

    const city = await prisma.city.findUnique({
      where: { id },
      select: { _count: { select: { orders: true } } },
    });

    if (!city) {
      return NextResponse.json({ error: 'المدينة غير موجودة' }, { status: 404 });
    }

    if (city._count.orders > 0) {
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف مدينة لها طلبات — سيكسر ذلك سجل الطلبات. عطّلها بدل حذفها.',
        },
        { status: 409 },
      );
    }

    await prisma.city.delete({ where: { id } });
    invalidateCities();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAdminError(error, 'DELETE /api/admin/cities');
  }
}

/**
 * ⚠️ بلا `export`. ملفات `route.ts` لا تُصدّر إلا أسماء المسارات
 * (GET/POST/…) وإعداداتها؛ وأي تصدير آخر يوقف البناء بـ TS2344 يذكر
 * «incompatible with index signature» — وهي رسالة لا تدلّ على سببها.
 */
async function handleAdminError(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية تنفيذ هذا الإجراء' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
