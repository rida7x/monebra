import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CategoriesManager } from '@/components/admin/CategoriesManager';

export const metadata: Metadata = {
  title: 'التصنيفات',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  await requirePageAccess('categories.manage');

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <CategoriesManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
      }))}
    />
  );
}
