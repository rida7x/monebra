import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  requireAdmin,
  revokeAllSessions,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth';
import { hashPassword, passwordIssues } from '@/lib/password';
import { ADMIN_ROLES } from '@/lib/constants';
import { logError } from '@/lib/logger';

/**
 * إدارة مستخدمي اللوحة.
 *
 * ثلاث حمايات ضرورية:
 *  1. **لا يعطّل المستخدم نفسه ولا يغيّر دوره** — وإلا حبس نفسه خارج اللوحة
 *  2. **لا يُحذف آخر مدير عام** — وإلا بقيت اللوحة بلا من يديرها
 *  3. **تغيير كلمة المرور أو التعطيل يُنهي كل جلسات المستخدم فورًا** —
 *     وإلا بقي الجهاز المسروق يعمل بالجلسة القديمة
 */

const CreateSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(120),
  email: z.string().trim().email('البريد غير صالح').max(200),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(200),
  role: z.enum(ADMIN_ROLES, { message: 'اختر دورًا من القائمة' }),
});

const UpdateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ADMIN_ROLES, { message: 'اختر دورًا من القائمة' }).optional(),
  isActive: z.boolean().optional(),
  password: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('users.manage');

    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير مكتملة' },
        { status: 400 },
      );
    }

    const issues = passwordIssues(parsed.data.password);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();

    const existing = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'يوجد مستخدم بهذا البريد بالفعل' },
        { status: 409 },
      );
    }

    const created = await prisma.adminUser.create({
      data: {
        name: parsed.data.name,
        email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return handle(error, 'POST /api/admin/users');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const current = await requireAdmin('users.manage');

    const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const isSelf = data.id === current.id;

    // حماية 1: لا يعطّل المستخدم نفسه ولا يغيّر دوره
    if (isSelf && (data.isActive === false || data.role !== undefined)) {
      return NextResponse.json(
        { error: 'لا يمكنك تغيير دورك أو تعطيل حسابك بنفسك' },
        { status: 400 },
      );
    }

    const target = await prisma.adminUser.findUnique({
      where: { id: data.id },
      select: { id: true, role: true, isActive: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // حماية 2: لا يبقى النظام بلا مدير عام مفعّل
    const losesSuperAdmin =
      target.role === 'super_admin' &&
      ((data.role !== undefined && data.role !== 'super_admin') ||
        data.isActive === false);

    if (losesSuperAdmin) {
      const remaining = await prisma.adminUser.count({
        where: {
          role: 'super_admin',
          isActive: true,
          id: { not: target.id },
        },
      });

      if (remaining === 0) {
        return NextResponse.json(
          {
            error:
              'لا يمكن تنفيذ هذا الإجراء — يجب أن يبقى مدير عام مفعّل واحد على الأقل.',
          },
          { status: 409 },
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.role !== undefined) update.role = data.role;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    if (data.password) {
      const issues = passwordIssues(data.password);
      if (issues.length > 0) {
        return NextResponse.json({ error: issues[0] }, { status: 400 });
      }
      update.passwordHash = await hashPassword(data.password);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'لا يوجد تغيير' }, { status: 400 });
    }

    await prisma.adminUser.update({ where: { id: data.id }, data: update });

    // حماية 3: تغيير كلمة المرور أو التعطيل يُنهي كل الجلسات فورًا
    if (data.password || data.isActive === false) {
      await revokeAllSessions(data.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'PATCH /api/admin/users');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const current = await requireAdmin('users.manage');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'المعرّف مفقود' }, { status: 400 });
    }

    if (id === current.id) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف حسابك بنفسك' },
        { status: 400 },
      );
    }

    const target = await prisma.adminUser.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (target.role === 'super_admin') {
      const remaining = await prisma.adminUser.count({
        where: { role: 'super_admin', isActive: true, id: { not: id } },
      });

      if (remaining === 0) {
        return NextResponse.json(
          { error: 'لا يمكن حذف آخر مدير عام مفعّل' },
          { status: 409 },
        );
      }
    }

    await prisma.adminUser.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handle(error, 'DELETE /api/admin/users');
  }
}

async function handle(error: unknown, path: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'ليست لديك صلاحية إدارة المستخدمين' },
      { status: 403 },
    );
  }

  await logError(error, { path });

  return NextResponse.json(
    { error: 'تعذّر تنفيذ العملية. حاول مرة أخرى.' },
    { status: 500 },
  );
}
