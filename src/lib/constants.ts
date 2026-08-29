/**
 * الثوابت المشتركة بين الواجهة والخادم.
 *
 * هذه ثوابت *نظام* (حالات الطلب، الأدوار، الصلاحيات) وليست بيانات متجر.
 * بيانات المتجر — المدن، الأسعار، المنتجات، أرقام التواصل — كلها في قاعدة
 * البيانات وتُدار من لوحة التحكم، ولا يجوز أن تظهر هنا.
 */

// ─────────────────────────── حالات الطلب ───────────────────────────

export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'طلب جديد',
  confirmed: 'تم تأكيد الطلب',
  preparing: 'قيد التجهيز',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
};

/** ألوان دلالية لكل حالة — مفاتيح فقط، القيم في نظام التصميم */
export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  new: 'info',
  confirmed: 'info',
  preparing: 'warning',
  out_for_delivery: 'warning',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'danger',
};

/** الحالات التي تُعيد المخزون عند الدخول إليها */
export const STOCK_RESTORING_STATUSES: readonly OrderStatus[] = [
  'cancelled',
  'returned',
];

/** الحالات النهائية التي لا يمكن الانتقال منها */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'cancelled',
  'returned',
];

/** الانتقالات المسموحة بين الحالات — يُفرض على الخادم */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

// ─────────────────────── الأدوار والصلاحيات ───────────────────────

export const ADMIN_ROLES = [
  'super_admin',
  'manager',
  'orders_manager',
  'inventory_manager',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام',
  manager: 'مدير',
  orders_manager: 'مسؤول الطلبات',
  inventory_manager: 'مسؤول المخزون',
};

export const PERMISSIONS = [
  'dashboard.view',
  'products.view',
  'products.manage',
  'categories.manage',
  'inventory.view',
  'inventory.manage',
  'orders.view',
  'orders.manage',
  'orders.delete',
  'customers.view',
  'customers.manage',
  'cities.manage',
  'coupons.manage',
  'reviews.manage',
  'content.manage',
  'settings.manage',
  'analytics.view',
  'users.manage',
  'logs.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * مصفوفة الصلاحيات لكل دور.
 * التوسع مستقبلًا: أضف دورًا هنا، أو استخدم `permissionsOverride` على
 * المستخدم لمنح صلاحية إضافية دون تعديل الأدوار.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,

  manager: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'categories.manage',
    'inventory.view',
    'inventory.manage',
    'orders.view',
    'orders.manage',
    'customers.view',
    'customers.manage',
    'cities.manage',
    'coupons.manage',
    'reviews.manage',
    'content.manage',
    'analytics.view',
  ],

  orders_manager: [
    'dashboard.view',
    'products.view',
    'inventory.view',
    'orders.view',
    'orders.manage',
    'customers.view',
  ],

  inventory_manager: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'inventory.view',
    'inventory.manage',
    'orders.view',
  ],
};

// ─────────────────────────── سمات المنتج ───────────────────────────

export const GENDERS = ['men', 'women', 'unisex'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  men: 'رجالي',
  women: 'نسائي',
  unisex: 'للجنسين',
};

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'الربيع',
  summer: 'الصيف',
  autumn: 'الخريف',
  winter: 'الشتاء',
};

export const OCCASIONS = ['daily', 'work', 'events', 'night'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  daily: 'الاستخدام اليومي',
  work: 'العمل',
  events: 'المناسبات',
  night: 'السهرات',
};

export const TIME_OF_DAY = ['day', 'night', 'both'] as const;
export type TimeOfDay = (typeof TIME_OF_DAY)[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  day: 'نهاري',
  night: 'ليلي',
  both: 'نهاري وليلي',
};

export const NOTE_TYPES = ['top', 'middle', 'base'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  top: 'النوتات العليا',
  middle: 'النوتات الوسطى',
  base: 'النوتات الأساسية',
};

/** مقياس الثبات والفوحان من 1 إلى 5 */
export const INTENSITY_LABELS: Record<number, string> = {
  1: 'خفيف جدًا',
  2: 'خفيف',
  3: 'متوسط',
  4: 'قوي',
  5: 'قوي جدًا',
};

export const PRODUCT_TYPES = ['simple', 'bundle'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// ─────────────────────────── المخزون ───────────────────────────

export const STOCK_LEVELS = ['in_stock', 'low_stock', 'out_of_stock'] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  in_stock: 'متوفر',
  low_stock: 'مخزون منخفض',
  out_of_stock: 'غير متوفر',
};

export function stockLevelOf(stock: number, threshold: number): StockLevel {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= threshold) return 'low_stock';
  return 'in_stock';
}

export const INVENTORY_REASONS = [
  'order',
  'cancel',
  'return',
  'restock',
  'adjustment',
] as const;

export type InventoryReason = (typeof INVENTORY_REASONS)[number];

export const INVENTORY_REASON_LABELS: Record<InventoryReason, string> = {
  order: 'خصم لطلب',
  cancel: 'إرجاع لإلغاء طلب',
  return: 'إرجاع مرتجع',
  restock: 'إضافة مخزون',
  adjustment: 'تعديل يدوي',
};

// ─────────────────────────── متفرقات ───────────────────────────

export const REVIEW_STATUSES = ['pending', 'approved', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'بانتظار المراجعة',
  approved: 'منشور',
  hidden: 'مخفي',
};

export const PAYMENT_METHODS = ['cod', 'mobicash', 'edfali'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'الدفع عند الاستلام',
  mobicash: 'موبي كاش',
  edfali: 'أدفعلي',
};

export const PAYMENT_METHOD_HINTS: Record<PaymentMethod, string> = {
  cod: 'تدفع للمندوب نقدًا عند استلام طلبك.',
  mobicash: 'تدفع من محفظة موبي كاش على هاتفك.',
  edfali: 'تدفع من حساب أدفعلي على هاتفك.',
};

/**
 * الطرق التي تُحصَّل إلكترونيًا قبل التسليم.
 *
 * ⚠️ الفرق ليس تسمية: طلب «الدفع عند الاستلام» يُنشأ مدفوعًا ضمنًا ويُسلَّم،
 * أما طلب إلكتروني فيبقى `paymentStatus = pending` حتى يصل تأكيد المصرف.
 * خلطهما يعني تسليم بضاعة لم يصل ثمنها.
 */
export const ONLINE_PAYMENT_METHODS = ['mobicash', 'edfali'] as const;

export function isOnlinePayment(method: string): boolean {
  return (ONLINE_PAYMENT_METHODS as readonly string[]).includes(method);
}

export const PRODUCT_SORTS = [
  'featured',
  'newest',
  'price_asc',
  'price_desc',
  'best_selling',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  featured: 'المختارة',
  newest: 'الأحدث',
  price_asc: 'السعر: من الأقل',
  price_desc: 'السعر: من الأعلى',
  best_selling: 'الأكثر مبيعًا',
};

/** الحد الأقصى لعدد المنتجات في الصفحة الواحدة — يمنع استنزاف الخادم */
export const MAX_PAGE_SIZE = 48;
export const DEFAULT_PAGE_SIZE = 24;

/** الحد الأقصى لكمية الصنف الواحد في الطلب */
export const MAX_ITEM_QUANTITY = 20;

/** الحد الأقصى لعدد الأصناف المختلفة في الطلب */
export const MAX_CART_LINES = 30;

/** بادئة رقم الطلب ونقطة البداية */
export const ORDER_NUMBER_PREFIX = 'MON';
export const ORDER_NUMBER_START = 10000;
