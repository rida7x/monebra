import { cache } from 'react';
import { prisma } from '@/lib/db';

/**
 * المدن ورسوم التوصيل.
 *
 * ⚠️ لا يوجد سعر توصيل واحد مكتوب في الكود. كل رسم يأتي من جدول `cities`
 * أو من تجاوز على مستوى المنطقة في `areas`، ويحدّده المدير من لوحة التحكم.
 *
 * ترتيب حساب الرسم:
 *   1. `area.deliveryFeeOverride` إن كانت المنطقة محددة ولها قيمة
 *   2. `city.deliveryFee`
 * وينطبق نفس الترتيب على مدة التوصيل.
 */

export type AreaOption = {
  id: string;
  name: string;
  deliveryFee: number;
  deliveryDays: string | null;
};

export type CityOption = {
  id: string;
  name: string;
  deliveryFee: number;
  deliveryDays: string | null;
  areas: AreaOption[];
};

/** المدن المفعّلة مع مناطقها — تُستخدم في نموذج إتمام الطلب */
export const getDeliveryOptions = cache(async (): Promise<CityOption[]> => {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      deliveryFee: true,
      deliveryDays: true,
      areas: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          deliveryFeeOverride: true,
          deliveryDaysOverride: true,
        },
      },
    },
  });

  return cities.map((city) => ({
    id: city.id,
    name: city.name,
    deliveryFee: city.deliveryFee,
    deliveryDays: city.deliveryDays,
    areas: city.areas.map((area) => ({
      id: area.id,
      name: area.name,
      deliveryFee: area.deliveryFeeOverride ?? city.deliveryFee,
      deliveryDays: area.deliveryDaysOverride ?? city.deliveryDays,
    })),
  }));
});

export type ResolvedDelivery = {
  cityId: string;
  cityName: string;
  areaId: string | null;
  areaName: string | null;
  fee: number;
  days: string | null;
};

/**
 * يتحقق من المدينة والمنطقة ويحسب الرسم — على الخادم حصرًا.
 *
 * يرفض: مدينة غير موجودة أو معطّلة، منطقة لا تتبع المدينة المرسلة، منطقة
 * معطّلة. هذا يمنع تمرير منطقة رخيصة من مدينة أخرى للحصول على رسم أقل.
 */
export async function resolveDelivery(
  cityId: string,
  areaId?: string | null,
): Promise<ResolvedDelivery | null> {
  const city = await prisma.city.findFirst({
    where: { id: cityId, isActive: true },
    select: { id: true, name: true, deliveryFee: true, deliveryDays: true },
  });

  if (!city) return null;

  if (!areaId) {
    return {
      cityId: city.id,
      cityName: city.name,
      areaId: null,
      areaName: null,
      fee: city.deliveryFee,
      days: city.deliveryDays,
    };
  }

  const area = await prisma.area.findFirst({
    // شرط `cityId` أساسي: يمنع ربط منطقة بمدينة لا تتبعها
    where: { id: areaId, cityId: city.id, isActive: true },
    select: {
      id: true,
      name: true,
      deliveryFeeOverride: true,
      deliveryDaysOverride: true,
    },
  });

  if (!area) return null;

  return {
    cityId: city.id,
    cityName: city.name,
    areaId: area.id,
    areaName: area.name,
    fee: area.deliveryFeeOverride ?? city.deliveryFee,
    days: area.deliveryDaysOverride ?? city.deliveryDays,
  };
}

/** عدد المدن المفعّلة — للعرض في واجهة المتجر */
export const countActiveCities = cache(async (): Promise<number> => {
  return prisma.city.count({ where: { isActive: true } });
});
