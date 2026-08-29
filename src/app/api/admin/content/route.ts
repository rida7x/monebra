import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { invalidateHero } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';

/**
 * إدارة المحتوى: صفحات السياسات وشريحة الواجهة الرئيسية.
 *
 * الرابط (`slug`) لصفحات المحتوى غير قابل للتعديل من هنا عمدًا: هذه
 * الصفحات مرتبطة بالتذييل وبروابط قد تكون منشورة، وتغيير الرابط يكسرها
 * بلا فائدة تُذكر. المدير يعدّل العنوان والنص فقط.
 */

const PageSchema = z.object({
  kind: z.literal('page'),
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2, 'العنوان مطلوب').max(160),
  body: z.string().trim().min(1, 'النص مطلوب').max(20_000),
  isActive: z.boolean(),
  metaTitle: z.string().trim().max(160).nullish(),
  metaDescription: z.string().trim().max(300).nullish(),
});

const HeroSchema = z.object({
  kind: z.literal('hero'),
  id: z.string().max(64).optional(),
  title: z.string().trim().min(1, 'العنوان مطلوب').max(120),
  subtitle: z.string().trim().max(200).nullish(),
  mediaUrl: z.string().trim().max(400).nullish(),
  mediaType: z.enum(['image', 'video'], { message: 'نوع الوسائط غير معروف' }),
  ctaText: z.string().trim().max(60).nullish(),
  ctaLink: z.string().trim().max(200).nullish(),
  ctaText2: z.string().trim().max(60).nullish(),
  ctaLink2: z.string().trim().max(200).nullish(),
  isActive: z.boolean(),
});

const Schema = z.discriminatedUnion('kind', [PageSchema, HeroSchema]);

export async function POST(request: NextRequest) {
  try {
    await requireAdmin('content.manage');

    const parsed = Schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'بيانات غير مكتملة' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.kind === 'page') {
      const page = await prisma.contentPage.update({
        where: { id: data.id },
        data: {
          title: data.title,
          body: data.body,
          isActive: data.isActive,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
        },
        select: { slug: true },
      }).catch(() => null);

      if (!page) {
        return NextResponse.json({ error: 'الصفحة غير موجودة' }, { status: 404 });
      }

      revalidatePath(`/pages/${page.slug}`);
      revalidatePath('/', 'layout');

      return NextResponse.json({ ok: true });
    }

    // ── شريحة الواجهة ──
    // الروابط الداخلية فقط: رابط خارجي في زر الواجهة الرئيسية يخرج
    // العميل من المتجر، وقد يُستغل للتصيّد إن سُرّب حساب إداري
    for (const link of [data.ctaLink, data.ctaLink2]) {
      if (link && !link.startsWith('/')) {
        return NextResponse.json(
          { error: 'روابط الأزرار يجب أن تكون داخلية وتبدأ بـ /' },
          { status: 400 },
        );
      }
    }

    if (data.mediaUrl && !data.mediaUrl.startsWith('/uploads/')) {
      return NextResponse.json(
        { error: 'ارفع الصورة من هذه الصفحة بدل لصق رابط خارجي' },
        { status: 400 },
      );
    }

    const payload = {
      title: data.title,
      subtitle: data.subtitle || null,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType,
      ctaText: data.ctaText || null,
      ctaLink: data.ctaLink || null,
      ctaText2: data.ctaText2 || null,
      ctaLink2: data.ctaLink2 || null,
      isActive: data.isActive,
    };

    if (data.id) {
      await prisma.heroSlide.update({ where: { id: data.id }, data: payload });
    } else {
      await prisma.heroSlide.create({ data: { ...payload, sortOrder: 0 } });
    }

    invalidateHero();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية إدارة المحتوى' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/content' });

    return NextResponse.json(
      { error: 'تعذّر حفظ المحتوى. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
