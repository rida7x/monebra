import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { deleteProduct, setProductActive } from '@/lib/services/admin-products';
import { invalidateProduct } from '@/lib/cache';
import { logError } from '@/lib/logger';

/** حذف منتج — يُرفض إن كان قد بيع من قبل */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('products.manage');
    const { id } = await context.params;

    const result = await deleteProduct(id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    invalidateProduct();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, 'DELETE /api/admin/products/[id]');
  }
}

/** نشر منتج أو إخفاؤه */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('products.manage');
    const { id } = await context.params;

    const body = (await request.json().catch(() => null)) as {
      isActive?: unknown;
    } | null;

    if (typeof body?.isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'قيمة النشر غير صالحة' },
        { status: 400 },
      );
    }

    const result = await setProductActive(id, body.isActive);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    invalidateProduct();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, 'PATCH /api/admin/products/[id]');
  }
}

async function handleError(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية إدارة المنتجات' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
