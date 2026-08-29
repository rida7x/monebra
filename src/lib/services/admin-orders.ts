import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants';
import { normalizePhone } from '@/lib/utils';

/**
 * استعلام الطلبات للوحة التحكم.
 *
 * كل المدخلات تأتي من الـ URL أي من المتصفح، فتُنظَّف هنا: الحالات غير
 * المعروفة تُهمَل، والتواريخ تُتحقَّق، وحجم الصفحة له سقف.
 */

const PAGE_SIZE = 25;
const MAX_PAGE = 400;

export type OrderFilters = {
  status?: OrderStatus;
  cityId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
};

export function parseOrderFilters(
  params: Record<string, string | string[] | undefined>,
): OrderFilters {
  const one = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const statusRaw = one('status');
  const status = ORDER_STATUSES.includes(statusRaw as OrderStatus)
    ? (statusRaw as OrderStatus)
    : undefined;

  const pageRaw = Number(one('page'));
  const page =
    Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, MAX_PAGE) : 1;

  return {
    status,
    cityId: one('city') || undefined,
    search: one('q')?.trim().slice(0, 60) || undefined,
    from: parseDate(one('from')),
    to: parseDate(one('to')),
    page,
  };
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildWhere(filters: OrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];

  if (filters.status) and.push({ status: filters.status });
  if (filters.cityId) and.push({ cityId: filters.cityId });

  if (filters.from) and.push({ createdAt: { gte: filters.from } });

  if (filters.to) {
    // نمدّ الحد الأعلى إلى نهاية اليوم المختار، وإلا استُبعدت طلبات اليوم نفسه
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: end } });
  }

  if (filters.search) {
    const phone = normalizePhone(filters.search);

    and.push({
      OR: [
        { orderNumber: { contains: filters.search.toUpperCase() } },
        { customerName: { contains: filters.search } },
        { customerPhone: { contains: phone ?? filters.search } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export async function queryOrders(filters: OrderFilters) {
  const where = buildWhere(filters);

  const [rows, total, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        cityName: true,
        areaName: true,
        total: true,
        status: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    // عدّاد لكل حالة — يُعرض على أزرار التصفية
    prisma.order.groupBy({ by: ['status'], _count: true }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of statusCounts) counts[row.status] = row._count;

  return {
    orders: rows,
    total,
    page: filters.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    statusCounts: counts,
  };
}

/** تفاصيل الطلب الكاملة للوحة التحكم — تشمل سجل الحالات ومن غيّرها */
export async function getAdminOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
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
      deviceType: true,
      referrer: true,
      stockApplied: true,
      stockRestored: true,
      createdAt: true,
      confirmedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      customer: {
        select: { id: true, ordersCount: true, totalSpent: true },
      },
      items: {
        select: {
          id: true,
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
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          admin: { select: { name: true } },
        },
      },
    },
  });
}

export type AdminOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminOrder>>
>;

/** المدن المستخدمة فعلًا في الطلبات — لقائمة التصفية */
export async function getOrderCities() {
  return prisma.city.findMany({
    where: { orders: { some: {} } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
