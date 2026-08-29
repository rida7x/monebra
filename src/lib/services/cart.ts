import { prisma } from '@/lib/db';
import { discountPercent } from '@/lib/money';
import {
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  stockLevelOf,
  type StockLevel,
} from '@/lib/constants';

/**
 * التحقق من السلة وتسعيرها — على الخادم حصرًا.
 *
 * ⚠️ هذه الدالة هي المصدر الوحيد للحقيقة في كل ما يتعلق بالأسعار والتوفر.
 * المتصفح يرسل `variantId` والكمية فقط؛ كل شيء آخر — الاسم، الصورة، السعر،
 * المتاح — يُقرأ من قاعدة البيانات هنا. تُستخدم في صفحة السلة وفي إنشاء
 * الطلب على حد سواء، فلا يمكن أن يختلف ما يراه العميل عمّا يُحتسب فعليًا.
 */

export type CartInputLine = { variantId: string; quantity: number };

export type CartIssue =
  | { type: 'removed'; variantId: string; name: string }
  | { type: 'out_of_stock'; variantId: string; name: string }
  | { type: 'quantity_reduced'; variantId: string; name: string; available: number };

export type CartItem = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  image: string | null;
  unitPrice: number;
  comparePrice: number | null;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  stockLevel: StockLevel;
  maxQuantity: number;
};

export type ValidatedCart = {
  items: CartItem[];
  issues: CartIssue[];
  subtotal: number;
  /** إجمالي ما وفّره العميل مقابل السعر قبل الخصم — للعرض فقط */
  savings: number;
  itemCount: number;
};

export const EMPTY_CART: ValidatedCart = {
  items: [],
  issues: [],
  subtotal: 0,
  savings: 0,
  itemCount: 0,
};

/** ينظّف مدخلات غير موثوقة قادمة من المتصفح */
export function sanitizeLines(raw: unknown): CartInputLine[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const lines: CartInputLine[] = [];

  for (const entry of raw) {
    if (lines.length >= MAX_CART_LINES) break;
    if (!entry || typeof entry !== 'object') continue;

    const { variantId, quantity } = entry as Record<string, unknown>;

    if (typeof variantId !== 'string' || variantId.length === 0) continue;
    if (variantId.length > 64) continue;
    if (seen.has(variantId)) continue;

    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) continue;

    seen.add(variantId);
    lines.push({
      variantId,
      quantity: Math.min(parsed, MAX_ITEM_QUANTITY),
    });
  }

  return lines;
}

export async function validateCart(
  lines: CartInputLine[],
): Promise<ValidatedCart> {
  if (lines.length === 0) return EMPTY_CART;

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: lines.map((line) => line.variantId) },
      isActive: true,
      product: { isActive: true },
    },
    select: {
      id: true,
      label: true,
      price: true,
      comparePrice: true,
      stock: true,
      lowStockThreshold: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  const items: CartItem[] = [];
  const issues: CartIssue[] = [];

  // نحافظ على ترتيب العميل حتى لا تقفز الأصناف في الواجهة
  for (const line of lines) {
    const variant = byId.get(line.variantId);

    // حُذف المنتج أو أخفاه المدير بعد إضافته إلى السلة
    if (!variant) {
      issues.push({
        type: 'removed',
        variantId: line.variantId,
        name: 'منتج لم يعد متاحًا',
      });
      continue;
    }

    const displayName = `${variant.product.name} — ${variant.label}`;

    if (variant.stock <= 0) {
      issues.push({
        type: 'out_of_stock',
        variantId: variant.id,
        name: displayName,
      });
      continue;
    }

    const quantity = Math.min(line.quantity, variant.stock, MAX_ITEM_QUANTITY);

    if (quantity < line.quantity) {
      issues.push({
        type: 'quantity_reduced',
        variantId: variant.id,
        name: displayName,
        available: quantity,
      });
    }

    items.push({
      variantId: variant.id,
      productId: variant.product.id,
      productName: variant.product.name,
      productSlug: variant.product.slug,
      variantLabel: variant.label,
      image: variant.product.images[0]?.url ?? null,
      unitPrice: variant.price,
      comparePrice: variant.comparePrice,
      discountPercent: discountPercent(variant.price, variant.comparePrice),
      quantity,
      lineTotal: variant.price * quantity,
      stock: variant.stock,
      stockLevel: stockLevelOf(variant.stock, variant.lowStockThreshold),
      maxQuantity: Math.min(variant.stock, MAX_ITEM_QUANTITY),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const savings = items.reduce((sum, item) => {
    if (!item.comparePrice || item.comparePrice <= item.unitPrice) return sum;
    return sum + (item.comparePrice - item.unitPrice) * item.quantity;
  }, 0);

  return {
    items,
    issues,
    subtotal,
    savings,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
