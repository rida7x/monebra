import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { invalidateCategories, invalidateProduct } from '@/lib/cache';
import { slugify } from '@/lib/utils';
import { logError } from '@/lib/logger';

/**
 * إدارة التصنيفات.
 *
 * التصنيف الذي يحتوي منتجات لا يُحذف: حذفه يترك المنتجات بلا تصنيف
 * ويكسر روابط `/category/[slug]` المنشورة على TikTok. نطلب من المدير
 * نقل المنتجات أولًا.
 */

const Schema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, 'اسم التصنيف مطلوب').max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('categories.manage');

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير مكتملة' },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const slug = await uniqueSlug(data.slug || data.name, data.id);

    const category = data.id
      ? await prisma.category.update({
          where: { id: data.id },
          data: {
            name: data.name,
            slug,
            description: data.description || null,
            isActive: data.isActive,
            ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          },
          select: { id: true },
        })
      : await prisma.category.create({
          data: {
            name: data.name,
            slug,
            description: data.description || null,
            isActive: data.isActive,
            sortOrder: data.sortOrder ?? 0,
          },
          select: { id: true },
        });

    invalidateCategories();
    invalidateProduct();

    return NextResponse.json({ ok: true, id: category.id, slug });
  } catch (error) {
    return handle(error, 'POST /api/admin/categories');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin('categories.manage');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'المعرّف مفقود' }, { status: 400 });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { products: true } } },
    });

    if (!category) {
      return NextResponse.json({ error: 'التصنيف غير موجود' }, { status: 404 });
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن حذف تصنيف يحتوي ${category._count.products} منتجًا. انقلها إلى تصنيف آخر أولًا، أو عطّل التصنيف.`,
        },
        { status: 409 },
      );
    }

    await prisma.category.delete({ where: { id } });
    invalidateCategories();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE /api/admin/categories');
  }
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'category';
  let candidate = root;
  let counter = 2;

  for (;;) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;

    candidate = `${root}-${counter}`;
    counter += 1;
  }
}

async function handle(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية إدارة التصنيفات' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
