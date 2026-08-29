import type { Metadata } from 'next';
import { requirePageAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ContentManager } from '@/components/admin/ContentManager';

export const metadata: Metadata = {
  title: 'المحتوى',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  await requirePageAccess('content.manage');

  const [hero, pages] = await Promise.all([
    prisma.heroSlide.findFirst({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        mediaUrl: true,
        mediaType: true,
        ctaText: true,
        ctaLink: true,
        ctaText2: true,
        ctaLink2: true,
        isActive: true,
      },
    }),
    prisma.contentPage.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        isActive: true,
        metaTitle: true,
        metaDescription: true,
      },
    }),
  ]);

  return <ContentManager hero={hero} pages={pages} />;
}
