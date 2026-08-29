import { NextResponse } from 'next/server';
import { readBlobImage, storageDriver, uploadedFileName } from '@/lib/storage';

/**
 * خدمة صور المنتجات من مخزن Netlify Blobs.
 *
 * مخزن Blobs ليس له رابط عام، فلا يمكن للمتصفح جلب الصورة منه مباشرة كما
 * يفعل مع ملف في `public/`. هذا المسار يقرأها ويخدمها.
 *
 * ⚠️ يعمل مع مزوّد `netlify-blobs` وحده. على التخزين المحلي تُخدَم الصور من
 * `public/uploads` مباشرةً بلا مرور بأي دالة، فنرد 404 هنا كي لا يوجد
 * مساران لنفس الصورة.
 *
 * التخزين المؤقت الطويل آمن: اسم الملف عشوائي ولا يُعاد استخدامه، فالصورة
 * تحت اسم معيّن لا تتغير أبدًا. بدونه تُستدعى دالة عند كل عرض لكل صورة —
 * وهو أبطأ للزائر وأثقل على حصة الاستدعاءات.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (storageDriver() !== 'netlify-blobs') {
    return new NextResponse(null, { status: 404 });
  }

  const { name: raw } = await params;

  // نمرّره عبر نفس حارس المسارات: بلا هذا يمكن طلب `../../` والوصول إلى
  // مفاتيح خارج ما رفعه المتجر
  const name = uploadedFileName(`/api/images/${raw}`);
  if (!name) return new NextResponse(null, { status: 404 });

  const data = await readBlobImage(name);
  if (!data) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(data.byteLength),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
