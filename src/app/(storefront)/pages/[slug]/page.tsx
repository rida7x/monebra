import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@/lib/db';
import { decodeSlug } from '@/lib/utils';

export const revalidate = 3600;

type PageProps = { params: Promise<{ slug: string }> };

/** ملفوفة بـ cache: استعلام واحد يخدم generateMetadata والصفحة معًا */
const loadPage = cache(async (slug: string) => {
  return prisma.contentPage.findFirst({
    where: { slug, isActive: true },
    select: {
      title: true,
      body: true,
      metaTitle: true,
      metaDescription: true,
      updatedAt: true,
    },
  });
});


/**
 * ⚠️ `notFound()` يجب أن تُستدعى هنا أيضًا، لا في مكوّن الصفحة وحده.
 *
 * عندما تنجح generateMetadata وتُرجع عنوانًا لمنتج غير موجود، يُثبّت Next
 * ترويسة الاستجابة ويبدأ البث بحالة 200، فيستحيل بعدها تغييرها إلى 404 حين
 * تستدعيها الصفحة. النتيجة: روابط منتجات وهمية تبدو صالحة لمحركات البحث.
 * الاستعلام ملفوف بـ cache() فلا يتكرر بين هذه الدالة والصفحة.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const page = await loadPage(slug);

  if (!page) notFound();

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.body.slice(0, 155),
    alternates: { canonical: `/pages/${slug}` },
  };
}

export async function generateStaticParams() {
  const pages = await prisma.contentPage.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  return pages.map((page) => ({ slug: page.slug }));
}

/**
 * صفحات المحتوى — من نحن، السياسات، إلخ.
 * المحتوى يُدار من لوحة التحكم ويُعرض كنص عادي مع احترام فواصل الأسطر.
 */
export default async function ContentPageView({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const page = await loadPage(slug);

  if (!page) notFound();

  return (
    <main className="container-page py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{page.title}</h1>
        <div className="mt-4 h-px w-16 rule-gold" />

        <div className="mt-8 whitespace-pre-line leading-loose text-[var(--text-secondary)]">
          {page.body}
        </div>

        <p className="mt-12 text-xs text-[var(--text-muted)]">
          آخر تحديث:{' '}
          <time dateTime={page.updatedAt.toISOString()}>
            {new Intl.DateTimeFormat('ar-LY', { dateStyle: 'long' }).format(
              page.updatedAt,
            )}
          </time>
        </p>
      </article>
    </main>
  );
}
