import { prisma } from '@/lib/db';
import { TERMINAL_STATUSES } from '@/lib/constants';

/**
 * إحصائيات لوحة التحكم.
 *
 * قاعدة محاسبية مهمة: **المبيعات تُحسب من الطلبات غير الملغاة فقط**.
 * لو أدخلنا الملغي والمرتجع في الإجمالي لأظهرنا للمدير رقمًا لم يقبضه،
 * وهو أسوأ من عدم إظهار رقم أصلًا.
 */

/** الحالات التي تُعدّ إيرادًا محقّقًا أو متوقّعًا */
const REVENUE_STATUSES = [
  'new',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
] as const;

export type DashboardStats = {
  revenueTotal: number;
  revenueDelivered: number;
  ordersTotal: number;
  ordersNew: number;
  ordersDelivered: number;
  ordersCancelled: number;
  customersTotal: number;
  productsTotal: number;
  productsHidden: number;
  lowStockCount: number;
  outOfStockCount: number;
  averageOrderValue: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    revenueAll,
    revenueDelivered,
    ordersTotal,
    ordersNew,
    ordersDelivered,
    ordersCancelled,
    customersTotal,
    productsTotal,
    productsHidden,
    variants,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { status: 'delivered' },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'new' } }),
    prisma.order.count({ where: { status: 'delivered' } }),
    prisma.order.count({ where: { status: { in: ['cancelled', 'returned'] } } }),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: false } }),
    prisma.productVariant.findMany({
      where: { isActive: true },
      select: { stock: true, lowStockThreshold: true },
    }),
  ]);

  const revenueTotal = revenueAll._sum.total ?? 0;
  const countedOrders = revenueAll._count;

  return {
    revenueTotal,
    revenueDelivered: revenueDelivered._sum.total ?? 0,
    ordersTotal,
    ordersNew,
    ordersDelivered,
    ordersCancelled,
    customersTotal,
    productsTotal,
    productsHidden,
    lowStockCount: variants.filter(
      (v) => v.stock > 0 && v.stock <= v.lowStockThreshold,
    ).length,
    outOfStockCount: variants.filter((v) => v.stock <= 0).length,
    averageOrderValue:
      countedOrders > 0 ? Math.round(revenueTotal / countedOrders) : 0,
  };
}

// ─────────────────────────── السلاسل الزمنية ───────────────────────────

export type SalesPoint = { label: string; revenue: number; orders: number };

/**
 * نطاقات منحنى المبيعات.
 *
 * التخصيص طلب مبيعات يومية وأسبوعية وشهرية وسنوية. بدل أربع دوال متشابهة
 * نجمّع في وحدة واحدة تختلف حبيبتها: أيام للنطاقات القصيرة، أشهر للسنة،
 * سنوات لكل الوقت — وإلا صار منحنى «كل الوقت» مئات النقاط غير مقروءة.
 */
export const SALES_RANGES = {
  week: { label: 'أسبوع', days: 7, unit: 'day' },
  month: { label: 'شهر', days: 30, unit: 'day' },
  year: { label: 'سنة', days: 365, unit: 'month' },
  all: { label: 'كل الوقت', days: null, unit: 'year' },
} as const;

export type SalesRange = keyof typeof SALES_RANGES;

export function isSalesRange(value: unknown): value is SalesRange {
  return typeof value === 'string' && value in SALES_RANGES;
}

/**
 * سلسلة المبيعات لنطاق مختار.
 *
 * نجمّع في التطبيق لا بـ `groupBy` على التاريخ، لأن استخراج اليوم أو الشهر
 * من الطابع الزمني يختلف بين SQLite و PostgreSQL — وهذا يبقي الكود صالحًا
 * للمزودين معًا دون SQL خام.
 */
export async function getSalesSeries(range: SalesRange): Promise<SalesPoint[]> {
  const config = SALES_RANGES[range];

  let since: Date | null = null;

  if (config.days !== null) {
    since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (config.days - 1));
  }

  const orders = await prisma.order.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      status: { in: [...REVENUE_STATUSES] },
    },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  // «كل الوقت» بلا طلبات: نعرض السنة الحالية فارغة بدل منحنى بلا محاور
  const start = since ?? orders[0]?.createdAt ?? new Date();

  const buckets = new Map<string, { revenue: number; orders: number }>();
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const now = new Date();

  if (config.unit === 'day') {
    while (cursor <= now) {
      buckets.set(dayKey(cursor), { revenue: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (config.unit === 'month') {
    cursor.setDate(1);
    while (cursor <= now) {
      buckets.set(monthKey(cursor), { revenue: 0, orders: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    cursor.setMonth(0, 1);
    while (cursor.getFullYear() <= now.getFullYear()) {
      buckets.set(String(cursor.getFullYear()), { revenue: 0, orders: 0 });
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
  }

  const keyOf = (date: Date) =>
    config.unit === 'day'
      ? dayKey(date)
      : config.unit === 'month'
        ? monthKey(date)
        : String(date.getFullYear());

  for (const order of orders) {
    const bucket = buckets.get(keyOf(order.createdAt));
    if (!bucket) continue;
    bucket.revenue += order.total;
    bucket.orders += 1;
  }

  const dayFormat = new Intl.DateTimeFormat('ar-LY', {
    day: 'numeric',
    month: 'short',
  });
  const monthFormat = new Intl.DateTimeFormat('ar-LY', {
    month: 'short',
    year: '2-digit',
  });

  return [...buckets.entries()].map(([key, value]) => ({
    label:
      config.unit === 'day'
        ? dayFormat.format(new Date(`${key}T00:00:00`))
        : config.unit === 'month'
          ? monthFormat.format(new Date(`${key}-01T00:00:00`))
          : key,
    revenue: value.revenue,
    orders: value.orders,
  }));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─────────────────────────── التصنيفات ───────────────────────────

export async function getTopProducts(limit = 5) {
  const rows = await prisma.orderItem.groupBy({
    by: ['productName'],
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  return rows.map((row) => ({
    name: row.productName,
    quantity: row._sum.quantity ?? 0,
    revenue: row._sum.lineTotal ?? 0,
  }));
}

export async function getTopCities(limit = 5) {
  const rows = await prisma.order.groupBy({
    by: ['cityName'],
    where: { status: { in: [...REVENUE_STATUSES] } },
    _count: true,
    _sum: { total: true },
    orderBy: { _count: { cityName: 'desc' } },
    take: limit,
  });

  return rows.map((row) => ({
    name: row.cityName,
    orders: row._count,
    revenue: row._sum.total ?? 0,
  }));
}

/** آخر الطلبات — للعرض السريع في لوحة المعلومات */
export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      cityName: true,
      total: true,
      status: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
}

/** الأحجام التي بلغت عتبة التنبيه — الأقل مخزونًا أولًا */
export async function getLowStockVariants(limit = 8) {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    orderBy: { stock: 'asc' },
    take: 60,
    select: {
      id: true,
      label: true,
      stock: true,
      lowStockThreshold: true,
      product: { select: { id: true, name: true, slug: true } },
    },
  });

  return variants
    .filter((variant) => variant.stock <= variant.lowStockThreshold)
    .slice(0, limit);
}

/** هل انتهى الطلب إلى حالة نهائية؟ — يستخدمه العرض لتلوين الصف */
export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
