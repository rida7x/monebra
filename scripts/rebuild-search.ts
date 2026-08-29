import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabaseAdapter } from '../src/lib/db-adapter.js';
import { buildSearchText } from '../src/lib/search.js';

/**
 * إعادة بناء نص البحث لكل المنتجات.
 *
 * يُشغَّل بعد استيراد بيانات، أو بعد تعديل دالة التطبيع، أو إذا اشتُبه في
 * أن عمود البحث لم يعد متسقًا. العمليات العادية تحدّثه تلقائيًا عند الحفظ.
 *
 *   npm run search:rebuild
 */

const adapter = createDatabaseAdapter(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      inspirationName: true,
      fragranceFamily: true,
      keywords: true,
      shortDescription: true,
      inspirationBrand: { select: { name: true, aliases: true } },
      category: { select: { name: true } },
      notes: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      // لإعادة حساب أقل سعر مع نص البحث في مرور واحد
      variants: { where: { isActive: true }, select: { price: true } },
    },
  });

  let updated = 0;

  for (const product of products) {
    const prices = product.variants.map((v) => v.price);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        searchText: buildSearchText(product),
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      },
    });
    updated += 1;
  }

  console.log(`✓ أُعيد بناء نص البحث وأقل سعر لـ ${updated} منتج`);
}

main()
  .catch((error) => {
    console.error('✗ فشل:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
